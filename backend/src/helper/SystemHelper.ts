import { execute } from "./CommandHelper";
import { getConfig } from "./ConfigHelper";
import { logRegular, logWarn } from "./LogHelper";
import { Gpio } from "onoff";
import getWebsocketServer from "../App";
import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs";
import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import {execSync} from "child_process";

/* ------------------------------------------------------------------
   Power button interception via evtest --grab
   ------------------------------------------------------------------ */

let evtestProc: ChildProcessWithoutNullStreams | null = null;

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
        // Check common path first
        if (fs.existsSync("/usr/bin/evtest")) return "/usr/bin/evtest";
        // Fallback: use which
        const out = execSync("which evtest", { stdio: ["ignore", "pipe", "ignore"] })
            .toString().trim();
        return out || null;
    } catch {
        return null;
    }
}

function startEvtestGrab(onPress: () => void) {
    if (evtestProc) return;

    const evtestPath = hasEvtest();
    if (!evtestPath) {
        logWarn("evtest not installed or not in PATH. Install with `sudo apt install evtest` (Debian/Ubuntu/RPi).");
        return;
    }

    const candidates = listEventCandidates();
    const first = candidates[0] || { dev: "/dev/input/event0", name: "" };

    evtestProc = spawn(evtestPath, ["--grab", first.dev], {
        stdio: ["ignore", "pipe", "pipe"]
    });

    evtestProc.stdout.setEncoding("utf8");
    evtestProc.stderr.setEncoding("utf8");

    logRegular(`Intercepting KEY_POWER on ${first.dev} using ${evtestPath} --grab`);

    evtestProc.stdout.on("data", (chunk: string) => {
        if (chunk.includes("code 116 (KEY_POWER)")) {
            const m = chunk.match(/value\s+(\d)/);
            const val = m ? Number(m[1]) : undefined;
            if (val === 1) {
                onPress();
            }
        }
    });

    evtestProc.stderr.on("data", (d: string) => {
        if (/Permission denied/i.test(d)) {
            logWarn(`evtest: permission denied reading ${first.dev}. Run as root or add user to 'input' group.`);
        } else {
            logWarn(d.trim());
        }
    });

    evtestProc.on("exit", (code, signal) => {
        logRegular(`evtest exited (code=${code} signal=${signal || ""})`);
        evtestProc = null;
    });
}

function stopEvtestGrab() {
    if (!evtestProc) return;
    try { evtestProc.kill("SIGTERM"); } catch {}
    evtestProc = null;
}

/* ------------------------------------------------------------------
   GPIO watcher (your own external buttons)
   ------------------------------------------------------------------ */

let powerButton: any = undefined;
let gpioActive = false;

export function initGpio() {
    const config = getConfig(/gpio/)[0];

    // Always intercept the real system power button via evdev
    startEvtestGrab(() => {
        getWebsocketServer().send("notify_power_button");
    });

    if (!config) return;

    gpioActive = true;
    killGpio(); // clean up previous watchers

    logRegular("init gpio");

    // NOTE: this is for your own wired GPIO pin, not the built-in system button
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
    // stop power-key interception
    stopEvtestGrab();

    if (!gpioActive) return;

    logRegular("clear up gpio Resources");
    if (powerButton) powerButton.unexport();
    gpioActive = false;
}

/* ------------------------------------------------------------------
   Utility helpers
   ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------
   Reboot / shutdown commands
   ------------------------------------------------------------------ */

function x(p: string) {
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
        if (x("/usr/bin/systemctl")) cmds.push("/usr/bin/systemctl reboot -i");
        if (x("/usr/bin/loginctl"))  cmds.push("/usr/bin/loginctl reboot");
        if (x("/sbin/shutdown"))     cmds.push("/sbin/shutdown -r now");
        if (x("/usr/sbin/shutdown")) cmds.push("/usr/sbin/shutdown -r now");
        if (x("/sbin/reboot"))       cmds.push("/sbin/reboot");
        if (x("/bin/busybox"))       cmds.push("/bin/busybox reboot");
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
        if (x("/usr/bin/systemctl")) cmds.push("/usr/bin/systemctl poweroff -i");
        if (x("/usr/bin/loginctl"))  cmds.push("/usr/bin/loginctl poweroff");
        if (x("/sbin/shutdown"))     cmds.push("/sbin/shutdown -h now");
        if (x("/usr/sbin/shutdown")) cmds.push("/usr/sbin/shutdown -h now");
        if (x("/sbin/poweroff"))     cmds.push("/sbin/poweroff");
        if (x("/bin/busybox"))       cmds.push("/bin/busybox poweroff");
        cmds.push("poweroff"); // fallback

        const ok = await runOneOf(cmds);
        if (ok) logRegular("Shutdown command issued.");
        else    logWarn("Shutdown failed: no valid command found.");
    } catch (e: any) {
        logWarn(`Shutdown failed: ${e?.message || e}`);
    }
}
