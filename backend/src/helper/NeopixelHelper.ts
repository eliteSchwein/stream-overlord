// NeopixelHelper.ts
import { getConfig } from "./ConfigHelper";
import { StripType, ws281x } from "piixel";
import {sleep} from "../../../helper/GeneralHelper";
import {isDebug, logWarn} from "./LogHelper";

type NeoCfg = {
    gpio: number;
    amount: number;
    heartbeat_index?: number; // preferred
    status_index?: number; // fallback
};

type StripState = {
    name: string;
    gpio: number;
    amount: number;
    pixels: Uint32Array; // packed 0xRRGGBB values
};

export type HeartbeatLedRef = { name: string; index: number };

// Exported: all heartbeat LEDs across all configured strips
export const heartbeatLeds: HeartbeatLedRef[] = [];

const strips = new Map<string, StripState>();

// piixel/ws281x is effectively a singleton config (one active strip)
let configured = false;
let activeStripName: string | null = null;

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

// Packed as 0xRRGGBB; StripType controls actual wire order on the LEDs.
function packColor(r: number, g: number, b: number): number {
    return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}

export async function initNeopixels() {
    const config = getConfig(/^neopixel /g, true) as Array<Record<string, NeoCfg>>;
    console.log(config);

    strips.clear();
    heartbeatLeds.length = 0;
    configured = false;
    activeStripName = null;

    if (!Array.isArray(config) || config.length === 0) return;

    // Parse config into strips + heartbeat list
    for (const obj of config) {
        for (const [name, cfg] of Object.entries(obj)) {
            if (!cfg || typeof cfg.gpio !== "number" || typeof cfg.amount !== "number") continue;

            const strip: StripState = {
                name,
                gpio: cfg.gpio,
                amount: cfg.amount,
                pixels: new Uint32Array(cfg.amount), // defaults to 0 == black
            };

            strips.set(name, strip);

            const hb =
                (typeof cfg.heartbeat_index === "number" ? cfg.heartbeat_index : undefined) ??
                (typeof cfg.status_index === "number" ? cfg.status_index : undefined);

            if (typeof hb === "number" && Number.isInteger(hb) && hb >= 0 && hb < cfg.amount) {
                heartbeatLeds.push({ name, index: hb });
            }
        }
    }

    if (strips.size === 0) return;

    // piixel/ws281x: effectively single-strip config
    const first = strips.values().next().value as StripState;

    ws281x.configure({
        // @ts-ignore
        gpio: first.gpio,
        leds: first.amount,
        type: StripType.WS2811_STRIP_GRB,
    });

    configured = true;
    activeStripName = first.name;

    // Set all LEDs black on init
    first.pixels.fill(0);
    ws281x.render(first.pixels);
}

export async function colorNeopixel(name: string, color: string, index: number | null = null) {
    if (!configured) {
        logWarn("Neopixels not initialized. Call initNeopixels() first.")
        return
    }

    const strip = strips.get(name);
    if (!strip) {
        logWarn(`Unknown neopixel strip "${name}".`)
        return
    }

    // enforce piixel single-strip limitation
    if (activeStripName !== name) {
        logWarn(`piixel/ws281x is configured for "${activeStripName}". Multiple strips aren't supported in this setup.`)
        return
    }

    try {
        const { r, g, b } = parseColor(color);
        const packed = packColor(r, g, b);

        if (index === null) {
            strip.pixels.fill(packed);
        } else {
            if (!Number.isInteger(index) || index < 0 || index >= strip.amount) {
                logWarn(`index out of range: ${index} (0..${strip.amount - 1})`)
                return
            }
            strip.pixels[index] = packed;
        }

        ws281x.render(strip.pixels);
    } catch (error) {
        logWarn(`Parsing LED color failed:`);
        logWarn(error.stderr?.toString());
    }
}

/**
 * Pulse heartbeat LEDs: turn them green, wait 100ms, then turn them off.
 * If not initialized, no active strip, or heartbeat LEDs are on a different strip,
 * it simply returns (no throw).
 */
export async function pulseHeartbeatLeds() {
    if (!configured || !activeStripName) return;

    const strip = strips.get(activeStripName);
    if (!strip) return;

    // Only pulse heartbeat LEDs that belong to the active strip (piixel limitation)
    const hbOnThisStrip = heartbeatLeds.filter((h) => h.name === activeStripName);
    if (hbOnThisStrip.length === 0) return;

    const green = packColor(0, 255, 0);

    // Turn heartbeat indices green (preserve other LEDs)
    for (const h of hbOnThisStrip) {
        if (h.index >= 0 && h.index < strip.amount) {
            strip.pixels[h.index] = green;
        }
    }
    ws281x.render(strip.pixels);

    await sleep(100);

    // Turn those indices back to black
    for (const h of hbOnThisStrip) {
        if (h.index >= 0 && h.index < strip.amount) {
            strip.pixels[h.index] = 0;
        }
    }
    ws281x.render(strip.pixels);
}
