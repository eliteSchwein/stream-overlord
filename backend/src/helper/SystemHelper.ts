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
 * We may need to grab multiple event devices that emit KEY_POWER,
 * otherwise the desktop can still see the power key via another node.
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
        const s = n.toLowerCase();
        if (/\bpower\b/.test(s)) return 100;
        if (/gpio-keys/.test(s)) return 60;
        if (/acpi/.test(s)) return 50;
        return 0;
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

function supportsKeyPower(evtestPath: string, dev: string): boolean {
    try {
        // prints "1" if supported, "0" if not
        const out = execSync(`${evtestPath} --query ${dev} EV_KEY KEY_POWER`, {
            stdio: ["ignore", "pipe", "ignore"]
        }).toString().trim();
        return out === "1";
    } catch {
        return false;
    }
}

function listPowerKeyDevices(evtestPath: string): Array<{ dev: string; name: string }> {
    // Start with what /proc reports (usually enough)
    const fromProc = listEventCandidates();
    const hits: Array<{ dev: string; name: string }> = [];

    for (const c of fromProc) {
        if (supportsKeyPower(evtestPath, c.dev)) hits.push(c);
    }

    // Fallback: scan /dev/input/event* directly if proc parsing missed it
    if (hits.length === 0) {
        try {
            const devs = fs.readdirSync("/dev/input")
                .filter(f => /^event\d+$/.test(f))
                .map(f => `/dev/input/${f}`);

            for (const dev of devs) {
                if (!supportsKeyPower(evtestPath, dev)) continue;
                const ev = path.basename(dev); // eventX
                const namePath = `/sys/class/input/${ev}/device/name`;
                const name = fs.existsSync(namePath) ? fs.readFileSync(namePath, "utf8").trim() : "";
                hits.push({ dev, name });
            }
        } catch {
            // ignore
        }
    }

    // Prefer likely physical power-button sources
    const score = (n: string) => {
        const s = (n || "").toLowerCase();
        let v = 0;
        if (s.includes("gpio-keys")) v += 50;
        if (s.includes("pwr")) v += 40;
        if (s.includes("power button")) v += 40;
        if (s.includes("power")) v += 20;

        // de-prioritize common non-physical “power” sources
        if (s.includes("consumer control")) v -= 30;
        if (s.includes("audio")) v -= 20;
        if (s.includes("keyboard")) v -= 10;
        return v;
    };

    // De-dupe by dev path
    const seen = new Set<string>();
    const deduped = hits.filter(h => (seen.has(h.dev) ? false : (seen.add(h.dev), true)));

    return deduped.sort((a, b) => score(b.name) - score(a.name));
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
        logWarn("No input devices report KEY_POWER support (evtest --query).");
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

        // line-buffer stdout to avoid chunk-splitting issues
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
                if (val !== 1) continue; // 1 = key down

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
                    `Run as root or ensure your user has write access to /dev/input/event* (often via group 'input').`
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

    startEvtestGrab(() => {
        getWebsocketServer().send("notify_power_button");
    });

    if (!config) return;

    gpioActive = true;
    killGpio();

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
    await execute(`bash -c "cd ${path.resolve(__dirname, "..", "..")} && git pull && systemctl restart --user stream-overlord"`);
}
