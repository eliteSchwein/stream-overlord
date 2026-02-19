// NeopixelHelper.ts
//
// pkexec + Python CLI backend (NO --frame).
// Calls root wrapper: /usr/local/bin/stream-overlord-neopixel
// which runs: /home/pi/stream-overlord/backend/helper/neopixel_cli.py in the venv.
//
// Assumptions about neopixel_cli.py (no --frame):
// - --gpio <n> required
// - --count <n> optional (defaults to 1)
// - --color <name|hex> required
// - --index <n> optional. If provided, the PY script should color index -> end
//   AND preserve other LEDs via its own state file (recommended).

import { getConfig } from "./ConfigHelper";
import { sleep } from "../../../helper/GeneralHelper";
import { isDebug, logRegular, logWarn } from "./LogHelper";
import { spawn } from "node:child_process";

type NeoCfg = {
    gpio: number;
    amount: number;
    heartbeat_index?: number;
};

type StripState = {
    name: string;
    gpio: number;
    amount: number;
};

export type HeartbeatLedRef = { name: string; index: number };
export const heartbeatLeds: HeartbeatLedRef[] = [];

const strips = new Map<string, StripState>();
let configured = false;

const WRAPPER = "/usr/local/bin/stream-overlord-neopixel";

const NAMED_COLORS: Record<string, string> = {
    black: "#000000",
    red: "#ff0000",
    green: "#00ff00",
    blue: "#0000ff",
    white: "#ffffff",
    yellow: "#ffff00",
    cyan: "#00ffff",
    magenta: "#ff00ff",
    orange: "#ffa500",
    purple: "#800080",
};

function parseColor(input: string): { r: number; g: number; b: number } {
    const s0 = input.trim().toLowerCase();
    const s = (NAMED_COLORS[s0] ?? s0).replace(/^#/, "");

    if (/^[0-9a-f]{6}$/i.test(s)) {
        return {
            r: parseInt(s.slice(0, 2), 16),
            g: parseInt(s.slice(2, 4), 16),
            b: parseInt(s.slice(4, 6), 16),
        };
    }

    if (/^[0-9a-f]{3}$/i.test(s)) {
        return {
            r: parseInt(s[0] + s[0], 16),
            g: parseInt(s[1] + s[1], 16),
            b: parseInt(s[2] + s[2], 16),
        };
    }

    throw new Error(
        `Invalid color "${input}". Use names (black/red/green/blue/...) or hex (#RRGGBB / RRGGBB / #RGB).`,
    );
}

function runPkexec(args: string[]): Promise<{ code: number; stderr: string; stdout: string }> {
    return new Promise((resolve) => {
        const p = spawn("pkexec", [WRAPPER, ...args], { stdio: ["ignore", "pipe", "pipe"] });

        let stdout = "";
        let stderr = "";

        p.stdout.on("data", (d) => (stdout += d.toString()));
        p.stderr.on("data", (d) => (stderr += d.toString()));

        p.on("close", (code) => resolve({ code: code ?? 1, stderr, stdout }));
        p.on("error", (err) =>
            resolve({ code: 1, stderr: `spawn error: ${String(err)}`, stdout: "" }),
        );
    });
}

async function callPythonSet(
    gpio: number,
    count: number | undefined,
    color: string,
    index: number | null,
): Promise<void> {
    const args: string[] = ["--gpio", String(gpio), "--color", color];

    // If count is undefined, python defaults to 1 (as requested)
    if (typeof count === "number") {
        args.push("--count", String(count));
    }

    // If index is provided, python colors index -> end (your desired semantics)
    if (index !== null) {
        args.push("--index", String(index));
    }

    const res = await runPkexec(args);
    if (res.code !== 0) {
        logWarn(`neopixel call failed: ${res.stderr.trim() || `exit ${res.code}`}`);
    } else if (isDebug && res.stderr.trim()) {
        // some libs print warnings to stderr even on success
        console.log(res.stderr.trim());
    }
}

// --- Config normalization ---
// Your getConfig prints like: [ pad7_status: {...} ]
// That means it's an Array with length 0 but with named properties.
// Normalize into list of [name, cfg].
function isNumericKey(k: string) {
    return /^[0-9]+$/.test(k);
}

function normalizeNeoConfig(raw: any): Array<[string, NeoCfg]> {
    const pairs: Array<[string, NeoCfg]> = [];

    if (Array.isArray(raw)) {
        if (raw.length > 0) {
            // expected: [ { name: cfg }, ... ]
            for (const obj of raw) {
                if (!obj || typeof obj !== "object") continue;
                for (const [name, cfg] of Object.entries(obj)) {
                    pairs.push([name, cfg as NeoCfg]);
                }
            }
        } else {
            // array with named props (your current case)
            for (const [name, cfg] of Object.entries(raw)) {
                if (isNumericKey(name)) continue;
                pairs.push([name, cfg as NeoCfg]);
            }
        }
    } else if (raw && typeof raw === "object") {
        for (const [name, cfg] of Object.entries(raw)) {
            pairs.push([name, cfg as NeoCfg]);
        }
    }

    return pairs;
}

export async function initNeopixels() {
    logRegular("init neopixels");

    const raw = getConfig(/^neopixel /g, true) as any;

    strips.clear();
    heartbeatLeds.length = 0;
    configured = false;

    const pairs = normalizeNeoConfig(raw);

    if (pairs.length === 0) {
        logWarn("No neopixel config entries found.");
        return;
    }

    for (const [name, cfg] of pairs) {
        if (!cfg || typeof cfg.gpio !== "number" || typeof cfg.amount !== "number") continue;

        strips.set(name, { name, gpio: cfg.gpio, amount: cfg.amount });

        if (
            typeof cfg.heartbeat_index === "number" &&
            Number.isInteger(cfg.heartbeat_index) &&
            cfg.heartbeat_index >= 0 &&
            cfg.heartbeat_index < cfg.amount
        ) {
            heartbeatLeds.push({ name, index: cfg.heartbeat_index });
        }
    }

    configured = strips.size > 0;
    if (!configured) {
        logWarn("Neopixel config parsed but no valid strips were created.");
        return;
    }

    // Set all strips black on init (python script should set all when index is null)
    // @ts-ignore
    for (const strip of strips.values()) {
        await callPythonSet(strip.gpio, strip.amount, "black", null);
    }
}

export async function colorNeopixel(name: string, color: string, index: number | null = null) {
    if (!configured) {
        logWarn("Neopixels not initialized. Call initNeopixels() first.");
        return;
    }

    const strip = strips.get(name);
    if (!strip) {
        logWarn(`Unknown neopixel strip "${name}".`);
        return;
    }

    // validate color early (so we can warn before pkexec)
    try {
        parseColor(color);
    } catch (e: any) {
        logWarn(`Parsing LED color failed: ${e?.message ?? String(e)}`);
        return;
    }

    // validate index
    if (index !== null) {
        if (!Number.isInteger(index) || index < 0 || index >= strip.amount) {
            logWarn(`index out of range: ${index} (0..${strip.amount - 1})`);
            return;
        }
    }

    // Important: we always pass count so python knows the strip length
    await callPythonSet(strip.gpio, strip.amount, color, index);
}

/**
 * Pulse heartbeat LEDs:
 * - set heartbeat LEDs green (python colors index->end, so we set individual LEDs by using index
 *   BUT this requires the python script to preserve state for other LEDs via its state file)
 * - wait 100ms
 * - set them off again (black)
 *
 * Never throws; returns if not configured.
 */
export async function pulseHeartbeatLeds() {
    if (!configured) return;

    // ON
    for (const h of heartbeatLeds) {
        const strip = strips.get(h.name);
        if (!strip) continue;
        if (h.index < 0 || h.index >= strip.amount) continue;

        // If your python script uses "index->end" semantics, this will color from heartbeat_index to end.
        // If you want ONLY that one LED, change the python semantics or add a --mode flag there.
        await callPythonSet(strip.gpio, strip.amount, "green", h.index);
    }

    await sleep(25);

    // OFF
    for (const h of heartbeatLeds) {
        const strip = strips.get(h.name);
        if (!strip) continue;
        if (h.index < 0 || h.index >= strip.amount) continue;

        await callPythonSet(strip.gpio, strip.amount, "black", h.index);
    }
}
