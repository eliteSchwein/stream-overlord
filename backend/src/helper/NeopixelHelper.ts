// NeopixelHelper.ts
//
// Replaces piixel usage with a pkexec + Python CLI backend.
// It calls your root wrapper: /usr/local/bin/stream-overlord-neopixel
// (which runs /home/pi/stream-overlord/backend/helper/neopixel_cli.py inside the venv)
//
// IMPORTANT for "single LED update preserves other LEDs":
// This helper renders a FULL frame using `--frame` (comma-separated RRGGBB list).
// If your current neopixel_cli.py does NOT yet support `--frame`, this helper will
// automatically fall back to the simpler `--index/--color` mode (but that may blank
// other LEDs depending on how the Python lib initializes pixels).

import { getConfig } from "./ConfigHelper";
import { sleep } from "../../../helper/GeneralHelper";
import { isDebug, logWarn } from "./LogHelper";
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
    pixels: Uint32Array; // packed 0xRRGGBB (our internal representation)
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

    // RRGGBB
    if (/^[0-9a-f]{6}$/i.test(s)) {
        return {
            r: parseInt(s.slice(0, 2), 16),
            g: parseInt(s.slice(2, 4), 16),
            b: parseInt(s.slice(4, 6), 16),
        };
    }

    // RGB
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

// Packed as 0xRRGGBB
function packColor(r: number, g: number, b: number): number {
    return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}

function toHex6(rgb: number): string {
    const r = (rgb >> 16) & 0xff;
    const g = (rgb >> 8) & 0xff;
    const b = rgb & 0xff;
    const hh = (n: number) => n.toString(16).padStart(2, "0");
    return `${hh(r)}${hh(g)}${hh(b)}`;
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

/**
 * Render the FULL pixel frame for a strip (preserves other LEDs).
 * Requires neopixel_cli.py to support:
 *   --frame "rrggbb,rrggbb,..."
 *
 * If the python script doesn't support --frame yet, we fall back to:
 *   - if all pixels are the same -> --color <x>
 *   - else -> best-effort: set-only-index (may blank others)
 */
async function renderStrip(strip: StripState): Promise<void> {
    // Preferred: full frame
    const frame = Array.from(strip.pixels, toHex6).join(",");

    let res = await runPkexec([
        "--gpio",
        String(strip.gpio),
        "--count",
        String(strip.amount),
        "--frame",
        frame,
    ]);

    if (res.code === 0) return;

    // If --frame is not supported by the python CLI, try a compatibility fallback
    const looksLikeUnknownArg =
        /unrecognized arguments:.*--frame/i.test(res.stderr) ||
        /unknown option.*--frame/i.test(res.stderr);

    if (!looksLikeUnknownArg) {
        logWarn(`neopixel render failed: ${res.stderr.trim() || `exit ${res.code}`}`);
        return;
    }

    // Fallback: if all pixels are same color, we can use --color <hex> (set all)
    const first = strip.pixels[0] ?? 0;
    const allSame = strip.pixels.every((v) => v === first);
    if (allSame) {
        const hex = toHex6(first);
        res = await runPkexec([
            "--gpio",
            String(strip.gpio),
            "--count",
            String(strip.amount),
            "--color",
            hex,
        ]);
        if (res.code !== 0) logWarn(`neopixel fallback(all) failed: ${res.stderr.trim() || res.code}`);
        return;
    }

    // Last resort fallback: cannot preserve mixed colors without --frame
    logWarn(
        "neopixel_cli.py does not support --frame; mixed-color updates cannot be preserved without it.",
    );
}

export async function initNeopixels() {
    const config = getConfig(/^neopixel /g, true) as Array<Record<string, NeoCfg>>;
    console.log(config)

    strips.clear();
    heartbeatLeds.length = 0;
    configured = false;

    if (!Array.isArray(config) || config.length === 0) return;

    for (const obj of config) {
        for (const [name, cfg] of Object.entries(obj)) {
            if (!cfg || typeof cfg.gpio !== "number" || typeof cfg.amount !== "number") continue;

            const strip: StripState = {
                name,
                gpio: cfg.gpio,
                amount: cfg.amount,
                pixels: new Uint32Array(cfg.amount), // black
            };
            strips.set(name, strip);

            if (
                typeof cfg.heartbeat_index === "number" &&
                Number.isInteger(cfg.heartbeat_index) &&
                cfg.heartbeat_index >= 0 &&
                cfg.heartbeat_index < cfg.amount
            ) {
                heartbeatLeds.push({ name, index: cfg.heartbeat_index });
            }
        }
    }

    configured = strips.size > 0;
    if (!configured) return;

    // Set all strips to black on init
    // @ts-ignore
    for (const strip of strips.values()) {
        strip.pixels.fill(0);
        await renderStrip(strip);
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

    let packed: number;
    try {
        const { r, g, b } = parseColor(color);
        packed = packColor(r, g, b);
    } catch (e: any) {
        logWarn(`Parsing LED color failed: ${e?.message ?? String(e)}`);
        return;
    }

    if (index === null) {
        strip.pixels.fill(packed);
    } else {
        if (!Number.isInteger(index) || index < 0 || index >= strip.amount) {
            logWarn(`index out of range: ${index} (0..${strip.amount - 1})`);
            return;
        }
        strip.pixels[index] = packed;
    }

    await renderStrip(strip);
}

/**
 * Pulse heartbeat LEDs:
 * - set heartbeat LEDs green
 * - wait 100ms
 * - set them off again (black)
 * Never throws; returns if not configured.
 */
export async function pulseHeartbeatLeds() {
    console.log(configured)
    if (!configured) return;

    const green = packColor(0, 255, 0);

    // ON
    for (const h of heartbeatLeds) {
        const strip = strips.get(h.name);
        if (!strip) continue;
        if (h.index < 0 || h.index >= strip.amount) continue;
        strip.pixels[h.index] = green;
    }
    // render all affected strips
    for (const strip of strips.values()) {
        await renderStrip(strip);
    }

    await sleep(100);

    // OFF
    for (const h of heartbeatLeds) {
        const strip = strips.get(h.name);
        if (!strip) continue;
        if (h.index < 0 || h.index >= strip.amount) continue;
        strip.pixels[h.index] = 0;
    }
    for (const strip of strips.values()) {
        await renderStrip(strip);
    }
}
