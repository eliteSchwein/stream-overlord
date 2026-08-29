// NeopixelHelper.ts
//
// Unix socket backend.
// A root systemd daemon owns the NeoPixel GPIO hardware and listens on:
//   /run/stream-overlord-neopixel/neopixel.sock
//
// No pkexec/sudo is needed for individual LED updates.

import {getNeopixelIntegrations} from "./IntegrationsHelper";
import {sleep} from "../../../helper/GeneralHelper";
import {logDebug, logRegular, logWarn} from "./LogHelper";
import {createConnection} from "node:net";

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

type NeopixelResponse = {
    ok?: boolean;
    error?: string;
};

export type HeartbeatLedRef = { name: string; index: number };
export const heartbeatLeds: HeartbeatLedRef[] = [];

const strips = new Map<string, StripState>();
let configured = false;

const SOCKET_PATH = "/run/stream-overlord-neopixel/neopixel.sock";

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

function sendCommand(command: Record<string, unknown>): Promise<NeopixelResponse> {
    return new Promise((resolve) => {
        const socket = createConnection(SOCKET_PATH);
        let response = "";
        let settled = false;

        const finish = (result: NeopixelResponse) => {
            if (settled) return;
            settled = true;
            socket.destroy();
            resolve(result);
        };

        socket.setTimeout(2000);

        socket.on("connect", () => {
            socket.write(`${JSON.stringify(command)}\n`);
        });

        socket.on("data", (data) => {
            response += data.toString();
            const newline = response.indexOf("\n");
            if (newline === -1) return;

            const line = response.slice(0, newline).trim();
            try {
                finish(JSON.parse(line) as NeopixelResponse);
            } catch {
                finish({ok: false, error: `invalid daemon response: ${line}`});
            }
        });

        socket.on("timeout", () => {
            finish({ok: false, error: "neopixel daemon timed out"});
        });

        socket.on("error", (err) => {
            finish({ok: false, error: err.message});
        });

        socket.on("end", () => {
            if (!settled) {
                finish({ok: false, error: "neopixel daemon closed the connection without a response"});
            }
        });
    });
}

async function callPythonSet(
    gpio: number,
    count: number | undefined,
    color: string,
    index: number | null,
): Promise<void> {
    const command: Record<string, unknown> = {
        command: "set",
        gpio,
        color,
    };

    if (typeof count === "number") {
        command.count = count;
    }

    if (index !== null) {
        command.index = index;
    }

    const res = await sendCommand(command);
    if (!res.ok) {
        logDebug(`neopixel call failed: ${res.error ?? "unknown daemon error"}`);
    }
}

export async function initNeopixels() {
    logRegular("init neopixels");

    const integrations = getNeopixelIntegrations();

    strips.clear();
    heartbeatLeds.length = 0;
    configured = false;

    const pairs = Object.entries(integrations);

    if (pairs.length === 0) {
        logWarn("No neopixel config entries found.");
        return;
    }

    for (const [name, cfg] of pairs) {
        if (!cfg || typeof cfg.gpio !== "number" || typeof cfg.amount !== "number") continue;

        const neoCfg = cfg as NeoCfg;
        strips.set(name, {name, gpio: neoCfg.gpio, amount: neoCfg.amount});

        if (
            typeof neoCfg.heartbeat_index === "number" &&
            Number.isInteger(neoCfg.heartbeat_index) &&
            neoCfg.heartbeat_index >= 0 &&
            neoCfg.heartbeat_index < neoCfg.amount
        ) {
            heartbeatLeds.push({name, index: neoCfg.heartbeat_index});
        }
    }

    configured = strips.size > 0;
    if (!configured) {
        logWarn("Neopixel config parsed but no valid strips were created.");
        return;
    }

    // Set all strips black on init.
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

    try {
        parseColor(color);
    } catch (e: any) {
        logWarn(`Parsing LED color failed: ${e?.message ?? String(e)}`);
        return;
    }

    if (index !== null) {
        if (!Number.isInteger(index) || index < 0 || index >= strip.amount) {
            logWarn(`index out of range: ${index} (0..${strip.amount - 1})`);
            return;
        }
    }

    await callPythonSet(strip.gpio, strip.amount, color, index);
}

/**
 * Pulse heartbeat LEDs green for 25ms, then turn them black again.
 * Index semantics are unchanged: the daemon colors index -> end.
 * Never throws; returns if not configured.
 */
export async function pulseHeartbeatLeds() {
    if (!configured) return;

    for (const h of heartbeatLeds) {
        const strip = strips.get(h.name);
        if (!strip) continue;
        if (h.index < 0 || h.index >= strip.amount) continue;

        await callPythonSet(strip.gpio, strip.amount, "green", h.index);
    }

    await sleep(25);

    for (const h of heartbeatLeds) {
        const strip = strips.get(h.name);
        if (!strip) continue;
        if (h.index < 0 || h.index >= strip.amount) continue;

        await callPythonSet(strip.gpio, strip.amount, "black", h.index);
    }
}
