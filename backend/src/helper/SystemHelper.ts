import {execute} from "./CommandHelper";
import {getConfig} from "./ConfigHelper";
import {logRegular, logWarn} from "./LogHelper";
import {Gpio} from "onoff";
import getWebsocketServer from "../App";
import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs";
import {spawn, ChildProcessWithoutNullStreams} from "node:child_process";

let powerButton: any = undefined;
let gpioActive = false;

// ---------- Power button intercept via `evtest --grab` ----------
let evtestProc: ChildProcessWithoutNullStreams | null = null;

function listEventCandidates(): Array<{dev: string; name: string}> {
    // Parse /proc/bus/input/devices -> map event node -> device name
    let txt = "";
    try {
        txt = fs.readFileSync("/proc/bus/input/devices", "utf8");
    } catch {
        return [];
    }
    const blocks = txt.split(/\n\n+/);
    const res: Array<{dev: string; name: string}> = [];
    for (const b of blocks) {
        const name = (b.match(/^N:\s*Name="([^"]+)"/m) || [])[1] || "";
        const handlers = (b.match(/^H:\s*Handlers=([^\n]+)/m) || [])[1] || "";
        const ev = handlers.split(/\s+/).find(h => /^event\d+$/.test(h));
        if (ev) res.push({dev: `/dev/input/${ev}`, name});
    }
    // Prefer names likely to contain the power key
    const score = (n: string) => {
        const s = n.toLowerCase();
        if (/\bpower\b/.test(s)) return 100;   // "Power Button"
        if (/gpio-keys/.test(s)) return 60;    // SBCs often expose power through this
        if (/acpi/.test(s)) return 50;         // ACPI power button
        return 0;
    };
    res.sort((a,b) => score(b.name) - score(a.name));
    return res;
}

function startEvtestGrab(onPress: () => void) {
    if (evtestProc) return;

    const candidates = listEventCandidates();
    const firstReadable = candidates.find(c => {
        try { fs.accessSync(c.dev, fs.constants.R_OK); return true; } catch { return false; }
    }) || {dev: "/dev/input/event0", name: ""};

    // Spawn: evtest --grab <device>
    // We parse lines like: "Event: time ..., type 1 (EV_KEY), code 116 (KEY_POWER), value 1"
    evtestProc = spawn("evtest", ["--grab", firstReadable.dev], {
        stdio: ["ignore", "pipe", "pipe"]
    });

    evtestProc.stdout.setEncoding("utf8");
    evtestProc.stderr.setEncoding("utf8");

    logRegular(`Intercepting KEY_POWER on ${firstReadable.dev} using evtest --grab`);

    evtestProc.stdout.on("data", (chunk: string) => {
        // Quick parse
        // Looking for "type 1 (EV_KEY), code 116 (KEY_POWER), value X"
        if (chunk.includes("code 116 (KEY_POWER)")) {
            const m = chunk.match(/value\s+(\d)/);
            const val = m ? Number(m[1]) : undefined;
            if (val === 1) {
                onPress();
            }
        }
    });

    evtestProc.stderr.on("data", (d: string) => {
        // Helpful warnings if permission denied etc.
        if (/Permission denied/i.test(d)) {
            logWarn(`evtest: permission denied reading ${firstReadable.dev}. Run as root or add user to 'input' group.`);
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

// ---------- Your existing GPIO logic ----------

export function initGpio() {
    const config = getConfig(/gpio/)[0];

    // Intercept the real power key for ALL Linux (works on desktops, laptops, SBCs)
    startEvtestGrab(() => {
        getWebsocketServer().send("notify_power_button");
    });

    if(!config) return;

    gpioActive = true;
    killGpio(); // ensure clean state

    logRegular('init gpio');

    // NOTE: This GPIO is for your own external button wiring.
    // The built-in system power button is *not* usually on a GPIO pin.
    powerButton = new Gpio(config.power_button, 'in', 'both');

    powerButton.watch((error: any, value) => {
        if (error) {
            logWarn('power button watch failed:');
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
            return;
        }
        if (value === 1) {
            getWebsocketServer().send('notify_power_button');
        }
    });
}

export function killGpio() {
    // stop power-key interception
    stopEvtestGrab();

    if(!gpioActive) return;

    logRegular('clear up gpio Resources');
    if(powerButton) powerButton.unexport();
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
        case "x64":
            return "x86_64";
        case "arm64":
            return "aarch64";
        default:
            return "armv7";
    }
}

export async function rebootSystem() { await execute('shutdown -r now'); }
export async function shutdownSystem() { await execute('shutdown -h now'); }
