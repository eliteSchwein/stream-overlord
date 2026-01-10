import { execute } from "./CommandHelper";
import { getConfig } from "./ConfigHelper";
import { logRegular, logWarn } from "./LogHelper";
import { Gpio } from "onoff";
import getWebsocketServer from "../App";
import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs";
import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { execSync } from "child_process";

/**
 * We keep multiple evtest processes because KEY_POWER can be emitted
 * by more than one /dev/input/eventX node. If we only grab one, the
 * desktop may still see it via another node and show the menu.
 */
let evtestProcs: ChildProcessWithoutNullStreams[] = [];
let lastPowerPressMs = 0;
const POWER_DEBOUNCE_MS = 400;

function listEventCandidates(): Array<{ dev: string; name: string }> {
    let txt = "";
    try { txt = fs.readFileSync("/proc/bus/input/devices", "utf8"); } catch { return []; }
    const blocks = txt.split(/\n\n+/);
    const res: Array<{ dev: string; name: string }> = [];

    for (const b of blocks) {
        const name = (b.match(/^N:\s*Name="([^"]+)"/m) || [])[1] || "";
        const handlers = (b.match(/^H:\s*Handlers=([^\n]+)/m) || [])[1] || "";
        const ev = handlers.split(/\s+/).find(h => /^event\d+$/.test(h));
        if (ev) res.push({ dev: `/dev/input/${ev}`, name });
    }

    const score = (n: string) => {
        const s = (n || "").toLowerCase();
        let v = 0;
        if (s.includes("gpio-keys")) v += 80;
        if (s.includes("pwr")) v += 60;
        if (/\bpower\b/.test(s)) v += 50;
        if (s.includes("acpi")) v += 30;

        // de-prioritize common non-physical sources
        if (s.includes("consumer control")) v -= 60;
        if (s.includes("audio")) v -= 30;
        if (s.includes("keyboard")) v -= 10;

        return v;
    };

    return res.sort((a, b) => score(b.name) - score(a.name));
}

function hasEvtest(): string | null {
    try {
        if (fs.existsSync("/usr/bin/evtest")) return "/usr/bin/evtest";
        const out = execSync("which evtest", { stdio: ["ignore", "pipe", "ignore"] })
            .toString().trim();
        return out || null;
    } catch {
        return null;
    }
}

/**
 * Detect whether an input device supports a given key code by reading:
 *   /sys/class/input/eventX/device/capabilities/key
 *
 * The file contains space-separated hex words, where the *rightmost* word
 * contains the lowest bits (0..31), next word to the left is 32..63, etc.
 */
function sysfsSupportsKeyCode(dev: string, keyCode: number): boolean {
    try {
        const ev = path.basename(dev); // eventX
        const capPath = `/sys/class/input/${ev}/device/capabilities/key`;
        const raw = fs.readFileSync(capPath, "utf8").trim();
        if (!raw) return false;

        const words = raw.split(/\s+/);
        // LSB word is at the rightmost position
        const wordIndex = Math.floor(keyCode / 32);
        const bitIndex = keyCode % 32;
        const fromRight = words.length - 1 - wordIndex;
        if (fromRight < 0) return false;

        const word = parseInt(words[fromRight], 16);
        if (Number.isNaN(word)) return false;

        return ((word >>> bitIndex) & 1) === 1;
    } catch {
        return false;
    }
}

function listPowerKeyDevices(evtestPath: string): Array<{ dev: string; name: string }> {
    // Prefer candidates from /proc parsing (nice names), but validate via sysfs caps
    const candidates = listEventCandidates();
    let hits = candidates.filter(c => sysfsSupportsKeyCode(c.dev, 116)); // 116 = KEY_POWER

    // Fallback: if proc parsing missed it, scan /dev/input/event*
    if (hits.length === 0) {
        try {
            const devs = fs.readdirSync("/dev/input")
                .filter(f => /^event\d+$/.test(f))
                .map(f => `/dev/input/${f}`)
                .sort((a, b) => {
                    const na = Number(path.basename(a).replace("event", ""));
                    const nb = Number(path.basename(b).replace("event", ""));
                    return na - nb;
                });

            for (const dev of devs) {
                if (!sysfsSupportsKeyCode(dev, 116)) continue;
                const ev = path.basename(dev);
                const namePath = `/sys/class/input/${ev}/device/name`;
                const name = fs.existsSync(namePath) ? fs.readFileSync(namePath, "utf8").trim() : "";
                hits.push({ dev, name });
            }
        } catch {
            // ignore
        }
    }

    // De-dupe by dev path
    const seen = new Set<string>();
    hits = hits.filter(h => (seen.has(h.dev) ? false : (seen.add(h.dev), true)));

    // Sort likely physical sources first (for nicer logs)
    const score = (n: string) => {
        const s = (n || "").toLowerCase();
        let v = 0;
        if (s.includes("gpio-keys")) v += 80;
        if (s.includes("pwr")) v += 60;
        if (s.includes("power button")) v += 60;
        if (s.includes("power")) v += 30;
        if (s.includes("consumer control")) v -= 60;
        if (s.includes("audio")) v -= 30;
        return v;
    };
    hits.sort((a, b) => score(b.name) - score(a.name));

    // NOTE: evtestPath is currently unused here but kept in signature
    // in case you later want to add an evtest-header fallback.
    void evtestPath;

    return hits;
}

function startEvtestGrab(onPress: () => void) {
    if (evtestProcs.length) return;

    const evtestPath = hasEvtest();
    if (!evtestPath) {
        logWarn("evtest not installed or not in PATH");
        return;
    }

    const targets = listPowerKeyDevices(evtestPath);
    if (!targets.length) {
        logWarn("No /dev/input/event* devices advertise KEY_POWER (code 116) in sysfs capabilities.");
        return;
    }

    logRegular(
        "Intercepting KEY_POWER with evtest --grab on:\n" +
        targets.map(t => `  ${t.dev} (${t.name || "unknown"})`).join("\n")
    );

    for (const t of targets) {
        const p = spawn(evtestPath, ["--grab", t.dev], {
            stdio: ["ignore", "pipe", "pipe"]
        });

        p.stdout.setEncoding("utf8");
        p.stderr.setEncoding("utf8");

        // Buffer by line to avoid chunk splitting issues
        let buf = "";
        p.stdout.on("data", (chunk: string) => {
            buf += chunk;

            let idx: number;
            while ((idx = buf.indexOf("\n")) >= 0) {
                const line = buf.slice(0, idx).trimEnd();
                buf = buf.slice(idx + 1);

                // Example:
                // Event: time ... type 1 (EV_KEY), code 116 (KEY_POWER), value 1
                const m = line.match(/code\s+116\s+\(KEY_POWER\),\s+value\s+(\d+)/);
                if (!m) continue;

                const val = Number(m[1]);
                if (val !== 1) continue; // 1 = keydown/press

                const now = Date.now();
                if (now - lastPowerPressMs < POWER_DEBOUNCE_MS) continue;
                lastPowerPressMs = now;

                onPress();
            }
        });

        p.stderr.on("data", (d: string) => {
            const msg = String(d).trim();
            if (!msg) return;

            if (/Permission denied/i.test(msg)) {
                logWarn(
                    `evtest: permission denied grabbing ${t.dev}. ` +
                    `You need write access to /dev/input/event* for --grab (often run as root or via group rules).`
                );
            } else {
                logWarn(msg);
            }
        });

        p.on("exit", (code, signal) => {
            logRegular(`evtest(${t.dev}) exited (code=${code} signal=${signal || ""})`);
            evtestProcs = evtestProcs.filter(x => x !== p);
        });

        evtestProcs.push(p);
    }
}

function stopEvtestGrab() {
    if (!evtestProcs.length) return;
    for (const p of evtestProcs) {
        try { p.kill("SIGTERM"); } catch {}
    }
    evtestProcs = [];
}

let powerButton: any = undefined;
let gpioActive = false;

export function initGpio() {
    const config = getConfig(/gpio/)[0];

    // IMPORTANT: clear old resources FIRST.
    // Your previous ordering started evtest and then immediately stopped it via killGpio().
    killGpio();

    // Always try to intercept the onboard power key (if available)
    startEvtestGrab(() => {
        getWebsocketServer().send("notify_power_button");
    });

    // Optional: external GPIO power button (your config-driven one)
    if (!config) return;

    gpioActive = true;
    logRegular("init gpio");

    powerButton = new Gpio(config.power_button, "in", "both");

    powerButton.watch((error: any, value) => {
        if (error) {
            logWarn("power button watch failed:");
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
            return;
        }
        if (value === 1) {
            getWebsocketServer().send("notify_power_button");
        }
    });
}

export function killGpio() {
    stopEvtestGrab();

    if (!gpioActive) return;

    logRegular("clear up gpio Resources");
    if (powerButton) powerButton.unexport();
    powerButton = undefined;
    gpioActive = false;
}

export function parsePath(filePath: string) {
    if (filePath.startsWith("~")) {
        return path.join(os.homedir(), filePath.slice(1));
    }
    return filePath;
}

export function getArch() {
    const realArch = process.arch;
    switch (realArch) {
        case "x64": return "x86_64";
        case "arm64": return "aarch64";
        default: return "armv7";
    }
}

function checkFile(p: string) {
    try { fs.accessSync(p, fs.constants.X_OK); return true; } catch { return false; }
}

async function runOneOf(cmds: string[]) {
    let lastErr: unknown = null;
    for (const cmd of cmds) {
        try {
            await execute(cmd);
            return true;
        } catch (e) {
            lastErr = e;
        }
    }
    if (lastErr) logWarn(String((lastErr as any)?.message ?? lastErr));
    return false;
}

export async function rebootSystem() {
    try {
        const cmds: string[] = [];
        if (checkFile("/usr/bin/systemctl")) cmds.push("/usr/bin/systemctl reboot -i");
        if (checkFile("/usr/bin/loginctl"))  cmds.push("/usr/bin/loginctl reboot");
        if (checkFile("/sbin/shutdown"))     cmds.push("/sbin/shutdown -r now");
        if (checkFile("/usr/sbin/shutdown")) cmds.push("/usr/sbin/shutdown -r now");
        if (checkFile("/sbin/reboot"))       cmds.push("/sbin/reboot");
        if (checkFile("/bin/busybox"))       cmds.push("/bin/busybox reboot");
        cmds.push("reboot"); // fallback

        const ok = await runOneOf(cmds);
        if (ok) logRegular("Reboot command issued.");
        else    logWarn("Reboot failed: no valid command found.");
    } catch (e: any) {
        logWarn(`Reboot failed: ${e?.message || e}`);
    }
}

export async function shutdownSystem() {
    try {
        const cmds: string[] = [];
        if (checkFile("/usr/bin/systemctl")) cmds.push("/usr/bin/systemctl poweroff -i");
        if (checkFile("/usr/bin/loginctl"))  cmds.push("/usr/bin/loginctl poweroff");
        if (checkFile("/sbin/shutdown"))     cmds.push("/sbin/shutdown -h now");
        if (checkFile("/usr/sbin/shutdown")) cmds.push("/usr/sbin/shutdown -h now");
        if (checkFile("/sbin/poweroff"))     cmds.push("/sbin/poweroff");
        if (checkFile("/bin/busybox"))       cmds.push("/bin/busybox poweroff");
        cmds.push("poweroff"); // fallback

        const ok = await runOneOf(cmds);
        if (ok) logRegular("Shutdown command issued.");
        else    logWarn("Shutdown failed: no valid command found.");
    } catch (e: any) {
        logWarn(`Shutdown failed: ${e?.message || e}`);
    }
}

export async function selfUpdate() {
    await execute(
        `bash -c "cd ${path.resolve(__dirname, "..", "..")} && git pull && systemctl restart --user stream-overlord"`
    );
}
