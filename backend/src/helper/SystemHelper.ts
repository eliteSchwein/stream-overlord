import {execute} from "./CommandHelper";
import {getConfig} from "./ConfigHelper";
import {logRegular, logWarn} from "./LogHelper";
import {Gpio} from "onoff";
import getWebsocketServer from "../App";
import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs";

// ---------------------
// Power button intercept (generic Linux via evdev)
// ---------------------

// We import at runtime to avoid TS typing issues
let evdevModule: any | null = null;
let powerDevHandle: any | null = null;
let powerGrabbed = false;

const KEY_POWER = 116;

function readProcBusInput(): Array<{event: string; name: string}> {
    let text = "";
    try {
        text = fs.readFileSync("/proc/bus/input/devices", "utf8");
    } catch {
        return [];
    }
    const blocks = text.split(/\n\n+/);
    const out: Array<{event: string; name: string}> = [];
    for (const b of blocks) {
        const name = (b.match(/^N:\s*Name="([^"]+)"/m) || [])[1] || "";
        const handlers = (b.match(/^H:\s*Handlers=([^\n]+)/m) || [])[1] || "";
        const ev = handlers.split(/\s+/).find(h => /^event\d+$/.test(h));
        if (ev) out.push({event: ev, name});
    }
    return out;
}

function candidateEventNodes(): string[] {
    const uniq = new Set<string>();

    // Prefer stable symlinks if present
    for (const dir of ["/dev/input/by-path", "/dev/input/by-id"]) {
        try {
            for (const f of fs.readdirSync(dir)) {
                if (f.endsWith("-event")) uniq.add(path.join(dir, f));
            }
        } catch {}
    }
    // Fallback to raw event nodes
    try {
        for (const f of fs.readdirSync("/dev/input")) {
            if (/^event\d+$/.test(f)) uniq.add(path.join("/dev/input", f));
        }
    } catch {}

    return Array.from(uniq);
}

function rankByPowerRelevance(nodes: string[]): string[] {
    const proc = readProcBusInput(); // [{event, name}]
    const byEvent = new Map(proc.map(p => [p.event, p.name]));
    const score = (name?: string) => {
        if (!name) return 0;
        const n = name.toLowerCase();
        if (/\bpower\b/.test(n)) return 100;      // "Power Button", etc.
        if (/gpio-keys/.test(n)) return 50;       // often includes power on SBCs
        if (/acpi/.test(n)) return 40;            // ACPI power button
        return 0;
    };
    return nodes.sort((a, b) => {
        const sa = score(byEvent.get(path.basename(a)));
        const sb = score(byEvent.get(path.basename(b)));
        return sb - sa; // higher score first
    });
}

async function initPowerIntercept(exclusiveGrab = true) {
    if (powerDevHandle) return; // already running

    try {
        // @ts-ignore
        evdevModule = require("node-evdev");
    } catch (e: any) {
        logWarn("node-evdev not installed. Run `npm i node-evdev`.");
        return;
    }

    const candidates = rankByPowerRelevance(candidateEventNodes());
    if (candidates.length === 0) {
        logWarn("No /dev/input event devices found to monitor for power key.");
        return;
    }

    for (const dev of candidates) {
        try {
            const d = new evdevModule(dev);
            await d.open();
            if (exclusiveGrab) {
                await d.grab(); // EVIOCGRAB — prevent others from seeing events
                powerGrabbed = true;
            } else {
                powerGrabbed = false;
            }

            logRegular(`Intercepting KEY_POWER on ${dev}${powerGrabbed ? " (exclusive)" : ""}`);

            d.on("EV_KEY", (e: any) => {
                // e.code numeric; 116 == KEY_POWER; e.value: 1=down, 0=up, 2=repeat
                if (e.code !== KEY_POWER) return;

                // Your bot's action:
                if (e.value === 1) {
                    getWebsocketServer().send("notify_power_button");
                    // Implement long/short press semantics here if you like
                }
            });

            d.on("error", (err: any) => {
                logWarn(`power intercept error on ${dev}: ${err?.message || err}`);
            });

            powerDevHandle = d;
            return; // use first successful device
        } catch (e: any) {
            logWarn(`Failed to open/grab ${dev}: ${e?.message || e}`);
            continue;
        }
    }

    logWarn("Could not intercept any input device for KEY_POWER. Check permissions (root or input group).");
}

async function killPowerIntercept() {
    if (!powerDevHandle) return;
    try {
        if (powerGrabbed && powerDevHandle.ungrab) await powerDevHandle.ungrab();
    } catch {}
    try {
        await powerDevHandle.close();
    } catch {}
    powerDevHandle = null;
    powerGrabbed = false;
    logRegular("power-button interception stopped");
}

// ---------------------
// Your existing code
// ---------------------

let powerButton: any = undefined
let gpioActive = false

export function initGpio() {
    // Start intercepting the real power key (works on all Linux)
    // Pass false if you only want to observe and keep OS default behavior
    void initPowerIntercept(true);

    const config = getConfig(/gpio/)[0]
    if(!config) return

    gpioActive = true
    killGpio()

    logRegular('init gpio')

    // NOTE: This watches a GPIO pin you configured yourself.
    // The physical "power button" on many systems is NOT a GPIO,
    // hence the evdev interception above.
    powerButton = new Gpio(config.power_button, 'in', 'both')

    powerButton.watch((error: any, value) => {
        if (error) {
            logWarn('power button watch failed:')
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
            return
        }

        if(value === 1) {
            getWebsocketServer().send('notify_power_button')
        }
    })
}

export function killGpio() {
    // stop evdev interception
    void killPowerIntercept();

    if(!gpioActive) return

    logRegular('clear up gpio Resources')
    if(powerButton) powerButton.unexport()
}

export function parsePath(filePath: string) {
    if (filePath.startsWith("~")) {
        return path.join(os.homedir(), filePath.slice(1));
    }
    return filePath;
}

export function getArch() {
    const realArch = process.arch

    switch (realArch) {
        case "x64":
            return "x86_64"
        case "arm64":
            return "aarch64"
        default:
            return "armv7"
    }
}

export async function rebootSystem() { await execute('shutdown -r now') }
export async function shutdownSystem() { await execute('shutdown -h now') }
