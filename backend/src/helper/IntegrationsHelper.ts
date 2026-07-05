import * as fs from "node:fs";
import * as path from "node:path";
import {getSystemConfigDirectory} from "./ConfigHelper";
import getWebsocketServer from "../App";

const integrationsPath = path.join(getSystemConfigDirectory(), "integrations.json");

const DEFAULT_NEOPIXEL_NAME = "tablet_leds";
const DEFAULT_NEOPIXEL_INTEGRATION: NeopixelIntegration = {
    gpio: 17,
    amount: 2,
    heartbeat_index: 1,
};

const runtimeState: {
    obsConnected: Record<string, boolean>;
    yoloboxConnected: boolean;
} = {
    obsConnected: {},
    yoloboxConnected: false,
};

export type WledIntegration = {
    ip: string;
};

export type ObsIntegration = {
    ip: string;
    port?: number;
    password?: string;
    /**
     * Deprecated persisted value from older builds.
     * Runtime connection state is intentionally not written to integrations.json.
     */
    connected?: boolean;
};

export type YoloboxIntegration = {
    enabled?: boolean;
    /**
     * Deprecated persisted value from older builds.
     * Runtime connection state is intentionally not written to integrations.json.
     */
    connected?: boolean;
    additionalDevices?: string[];
};

export type NeopixelIntegration = {
    gpio: number;
    amount: number;
    heartbeat_index?: number;
};

export type Integrations = {
    twitch?: {
        control?: any;
        message?: any;
    };
    wled?: Record<string, WledIntegration>;
    obs?: Record<string, ObsIntegration>;
    yolobox?: YoloboxIntegration;
    neopixel?: Record<string, NeopixelIntegration>;
};

export type SafeObsIntegration = Omit<ObsIntegration, "password" | "connected"> & {
    hasPassword: boolean;
    connected: boolean;
};

export type SafeYoloboxIntegration = {
    enabled: boolean;
    connected: boolean;
};

export type SafeIntegrations = {
    twitch: {
        control: boolean;
        message: boolean;
    };
    wled: Record<string, WledIntegration>;
    obs: Record<string, SafeObsIntegration>;
    yolobox: SafeYoloboxIntegration;
    neopixel: Record<string, NeopixelIntegration>;
};

function sanitizeHost(value: string) {
    return value.trim().replace(/^wss?:\/\//, "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

function normalizeObsName(name: string) {
    return String(name ?? "default").trim() || "default";
}

function sanitizeIntegrationsForDisk(data: Integrations): Integrations {
    const cloned: Integrations = JSON.parse(JSON.stringify(data ?? {}));

    for (const name in cloned.obs ?? {}) {
        delete cloned.obs?.[name]?.connected;
    }

    if (cloned.yolobox) {
        delete cloned.yolobox.connected;
    }

    return cloned;
}

function normalizeNeopixelIntegration(data: NeopixelIntegration): NeopixelIntegration {
    const gpio = Number(data.gpio);
    const amount = Number(data.amount);

    if (!Number.isInteger(gpio) || gpio < 0) {
        throw new Error("gpio is invalid");
    }

    if (!Number.isInteger(amount) || amount <= 0) {
        throw new Error("amount is invalid");
    }

    const normalized: NeopixelIntegration = {gpio, amount};

    if (data.heartbeat_index !== undefined && data.heartbeat_index !== null) {
        const heartbeatIndex = Number(data.heartbeat_index);

        if (!Number.isInteger(heartbeatIndex) || heartbeatIndex < 0 || heartbeatIndex >= amount) {
            throw new Error("heartbeat_index is invalid");
        }

        normalized.heartbeat_index = heartbeatIndex;
    }

    return normalized;
}

export function ensureDefaultNeopixelIntegration() {
    const integrations = readIntegrations();

    integrations.neopixel ??= {};

    if (integrations.neopixel[DEFAULT_NEOPIXEL_NAME]) {
        return integrations.neopixel;
    }

    integrations.neopixel[DEFAULT_NEOPIXEL_NAME] = {...DEFAULT_NEOPIXEL_INTEGRATION};

    writeIntegrations(integrations);

    return integrations.neopixel;
}

export function readIntegrations(): Integrations {
    if (!fs.existsSync(integrationsPath)) return {};

    try {
        return JSON.parse(fs.readFileSync(integrationsPath, "utf8"));
    } catch {
        return {};
    }
}

export function writeIntegrations(data: Integrations) {
    fs.mkdirSync(path.dirname(integrationsPath), {recursive: true});
    fs.writeFileSync(integrationsPath, JSON.stringify(sanitizeIntegrationsForDisk(data), null, 4), "utf8");
}

export function getIntegrationsSafe(): SafeIntegrations {
    const integrations = readIntegrations();
    const safeNeopixel = ensureDefaultNeopixelIntegration();
    const safeObs: Record<string, SafeObsIntegration> = {};

    for (const name in integrations.obs ?? {}) {
        const obs = integrations.obs?.[name];

        if (!obs) continue;

        const normalizedName = normalizeObsName(name);

        safeObs[normalizedName] = {
            ip: obs.ip,
            port: obs.port,
            hasPassword: Boolean(obs.password),
            connected: Boolean(runtimeState.obsConnected[normalizedName]),
        };
    }

    return {
        twitch: {
            control: Boolean(integrations.twitch?.control?.accessToken),
            message: Boolean(integrations.twitch?.message?.accessToken),
        },
        wled: integrations.wled ?? {},
        obs: safeObs,
        yolobox: {
            enabled: Boolean(integrations.yolobox?.enabled),
            connected: runtimeState.yoloboxConnected,
        },
        neopixel: safeNeopixel,
    };
}

export function emitIntegrationsUpdate() {
    getWebsocketServer().send("notify_integrations_update", getIntegrationsSafe());
}

export function getWledIntegrations() {
    return readIntegrations().wled ?? {};
}

export function addWledIntegration(name: string, data: WledIntegration) {
    if (!name) throw new Error("name is required");
    if (!data.ip) throw new Error("ip is required");

    const integrations = readIntegrations();

    integrations.wled ??= {};
    integrations.wled[name] = {
        ip: sanitizeHost(data.ip),
    };

    writeIntegrations(integrations);
    emitIntegrationsUpdate();
}

export function removeWledIntegration(name: string) {
    if (!name) throw new Error("name is required");

    const integrations = readIntegrations();

    if (integrations.wled) {
        delete integrations.wled[name];
    }

    writeIntegrations(integrations);
    emitIntegrationsUpdate();
}

export function getObsIntegrations() {
    return readIntegrations().obs ?? {};
}

export function addObsIntegration(name: string, data: ObsIntegration) {
    const normalizedName = normalizeObsName(name);

    if (!data.ip) throw new Error("ip is required");

    const port = Number(data.port ?? 4455);

    if (!Number.isFinite(port) || port <= 0) {
        throw new Error("port is invalid");
    }

    const integrations = readIntegrations();

    integrations.obs ??= {};
    integrations.obs[normalizedName] = {
        ip: sanitizeHost(data.ip),
        port,
        password: String(data.password ?? ""),
    };

    runtimeState.obsConnected[normalizedName] = false;

    writeIntegrations(integrations);
    emitIntegrationsUpdate();
}

export function removeObsIntegration(name: string) {
    const normalizedName = normalizeObsName(name);

    const integrations = readIntegrations();

    if (integrations.obs) {
        delete integrations.obs[normalizedName];
    }

    delete runtimeState.obsConnected[normalizedName];

    writeIntegrations(integrations);
    emitIntegrationsUpdate();
}

export function setObsIntegrationConnected(name: string, connected: boolean) {
    const normalizedName = normalizeObsName(name);
    const hasIntegration = Boolean(readIntegrations().obs?.[normalizedName]);

    if (!hasIntegration) {
        return;
    }

    if (runtimeState.obsConnected[normalizedName] === connected) {
        return;
    }

    runtimeState.obsConnected[normalizedName] = connected;
    emitIntegrationsUpdate();
}

export function clearObsIntegrationConnections() {
    let changed = false;

    for (const name in runtimeState.obsConnected) {
        if (!runtimeState.obsConnected[name]) continue;

        runtimeState.obsConnected[name] = false;
        changed = true;
    }

    if (changed) {
        emitIntegrationsUpdate();
    }
}


export function getNeopixelIntegrations() {
    return ensureDefaultNeopixelIntegration();
}

export function addNeopixelIntegration(name: string, data: NeopixelIntegration) {
    const normalizedName = String(name ?? "").trim();

    if (!normalizedName) throw new Error("name is required");

    const integrations = readIntegrations();

    integrations.neopixel ??= {};
    integrations.neopixel[normalizedName] = normalizeNeopixelIntegration(data);

    writeIntegrations(integrations);
    emitIntegrationsUpdate();
}

export function removeNeopixelIntegration(name: string) {
    const normalizedName = String(name ?? "").trim();

    if (!normalizedName) throw new Error("name is required");

    const integrations = readIntegrations();

    if (integrations.neopixel) {
        delete integrations.neopixel[normalizedName];
    }

    writeIntegrations(integrations);
    emitIntegrationsUpdate();
}

export function getYoloboxIntegration() {
    return readIntegrations().yolobox ?? {};
}

export function isYoloboxIntegrationEnabled() {
    return Boolean(getYoloboxIntegration().enabled);
}

export function setYoloboxIntegrationEnabled(enabled: boolean) {
    const integrations = readIntegrations();

    integrations.yolobox ??= {};
    integrations.yolobox.enabled = Boolean(enabled);

    if (!enabled) {
        runtimeState.yoloboxConnected = false;
    }

    writeIntegrations(integrations);
    emitIntegrationsUpdate();
}

export function setYoloboxIntegrationConnected(connected: boolean) {
    if (runtimeState.yoloboxConnected === connected) {
        return;
    }

    runtimeState.yoloboxConnected = connected;
    emitIntegrationsUpdate();
}
