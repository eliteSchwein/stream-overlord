import {execute} from "./CommandHelper";
import {getConfig} from "./ConfigHelper";
import {logRegular, logWarn} from "./LogHelper";
import getWebsocketServer from "../App";
import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs";

/**
 * Normal GPIO handling only.
 * Power-button interception / evtest / /dev/input handling was intentionally removed.
 */
type GpioInstance = {
    watch: (callback: (error: Error | null | undefined, value: number) => void) => void;
    unwatchAll: () => void;
    unexport: () => void;
    writeSync?: (value: number) => void;
};

type GpioConstructor = new (
    pin: number,
    direction: "in" | "out" | "high" | "low",
    edge?: "none" | "rising" | "falling" | "both",
    options?: Record<string, any>
) => GpioInstance;

type GpioConfig = {
    pin?: number | string;
    gpio?: number | string;
    direction?: "in" | "out" | "high" | "low";
    edge?: "none" | "rising" | "falling" | "both";
    activeLow?: boolean;
    debounceTimeout?: number;
    method?: string;
    event?: string;
    data?: any;
    value?: number | string | boolean;
};

let gpioPins: GpioInstance[] = [];

function loadGpioConstructor(): GpioConstructor | null {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require("onoff");
        return mod.Gpio || mod.default?.Gpio || null;
    } catch (error: any) {
        logWarn(`GPIO unavailable: onoff could not be loaded (${error?.message || error})`);
        return null;
    }
}

function parsePin(config: GpioConfig): number | null {
    const raw = config.pin ?? config.gpio;
    const pin = Number(raw);

    if (!Number.isInteger(pin) || pin < 0) {
        return null;
    }

    return pin;
}

function normalizeEdge(edge: any): "none" | "rising" | "falling" | "both" {
    const normalized = String(edge ?? "both").trim().toLowerCase();

    if (["none", "rising", "falling", "both"].includes(normalized)) {
        return normalized as "none" | "rising" | "falling" | "both";
    }

    return "both";
}

function normalizeDirection(direction: any): "in" | "out" | "high" | "low" {
    const normalized = String(direction ?? "in").trim().toLowerCase();

    if (["in", "out", "high", "low"].includes(normalized)) {
        return normalized as "in" | "out" | "high" | "low";
    }

    return "in";
}

function parseBoolean(value: any, fallback = false): boolean {
    if (value === undefined || value === null || value === "") return fallback;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;

    const normalized = String(value).trim().toLowerCase();
    if (["true", "1", "yes", "on", "enabled", "enable"].includes(normalized)) return true;
    if (["false", "0", "no", "off", "disabled", "disable"].includes(normalized)) return false;

    return fallback;
}

function parseOutputValue(value: any): number {
    if (typeof value === "boolean") return value ? 1 : 0;
    if (typeof value === "number") return value ? 1 : 0;

    const normalized = String(value ?? "0").trim().toLowerCase();
    return ["1", "true", "high", "on", "yes"].includes(normalized) ? 1 : 0;
}

function notifyGpio(config: GpioConfig, value: number) {
    const method = config.method || config.event || "notify_gpio";
    const data = {
        ...(config.data || {}),
        pin: parsePin(config),
        value,
    };

    getWebsocketServer().send(method, data);
}

export function initGpio() {
    killGpio();

    const Gpio = loadGpioConstructor();
    if (!Gpio) return;

    const configs = getConfig(/gpio/g, true) as Record<string, GpioConfig> | GpioConfig[];
    const entries = Array.isArray(configs)
        ? configs.map((config, index) => [`gpio_${index}`, config] as const)
        : Object.entries(configs || {});

    if (!entries.length) {
        logRegular("No GPIO config found.");
        return;
    }

    for (const [name, config] of entries) {
        const pin = parsePin(config);

        if (pin === null) {
            logWarn(`GPIO ${name}: missing or invalid pin/gpio value`);
            continue;
        }

        const direction = normalizeDirection(config.direction);
        const edge = direction === "in" ? normalizeEdge(config.edge) : "none";
        const options = {
            activeLow: parseBoolean(config.activeLow, false),
            debounceTimeout: Number(config.debounceTimeout ?? 10),
        };

        try {
            const gpio = new Gpio(pin, direction, edge, options);
            gpioPins.push(gpio);

            if (direction === "out" && config.value !== undefined && gpio.writeSync) {
                gpio.writeSync(parseOutputValue(config.value));
            }

            if (direction === "in") {
                gpio.watch((error, value) => {
                    if (error) {
                        logWarn(`GPIO ${name} / pin ${pin} watch error: ${error.message}`);
                        return;
                    }

                    notifyGpio(config, value);
                });
            }

            logRegular(`GPIO ${name}: initialized pin ${pin} direction=${direction} edge=${edge}`);
        } catch (error: any) {
            logWarn(`GPIO ${name}: failed to initialize pin ${pin}: ${error?.message || error}`);
        }
    }
}

export function killGpio() {
    for (const gpio of gpioPins) {
        try { gpio.unwatchAll(); } catch {}
        try { gpio.unexport(); } catch {}
    }

    gpioPins = [];
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
        cmds.push("reboot");

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
        cmds.push("poweroff");

        const ok = await runOneOf(cmds);
        if (ok) logRegular("Shutdown command issued.");
        else    logWarn("Shutdown failed: no valid command found.");
    } catch (e: any) {
        logWarn(`Shutdown failed: ${e?.message || e}`);
    }
}

export async function selfUpdate() {
    await execute(`bash -c "cd ${path.resolve(__dirname, "..", "..")} && git pull && sudo rm -rf node_modules && npm ci && systemctl restart --user stream-overlord"`);
}
