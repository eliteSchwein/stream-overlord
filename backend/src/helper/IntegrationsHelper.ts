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

let integrationsCache: Integrations | null = null;

export function loadIntegrationsCache(force = false): Integrations {
    if (integrationsCache && !force) {
        return integrationsCache;
    }

    if (!fs.existsSync(integrationsPath)) {
        integrationsCache = {};
        return integrationsCache;
    }

    try {
        integrationsCache = JSON.parse(fs.readFileSync(integrationsPath, "utf8"));
    } catch {
        integrationsCache = {};
    }

    return integrationsCache;
}

export function reloadIntegrationsCache(): Integrations {
    return loadIntegrationsCache(true);
}

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

export type TwitchIntegration = {
    client_id?: string;
    client_secret?: string;
    clientId?: string;
    clientSecret?: string;
    control?: any;
    message?: any;
};

export type ExternalAiProvider = "ollama" | "openai";

export type OllamaExternalProviderConfig = {
    url?: string;
    api_key?: string;
    model?: string;
};

export type OllamaIntegration = {
    enabled?: boolean;

    // Active model. Kept for compatibility with the existing frontend/API surface.
    model?: string;

    // Internal mode stays managed Ollama with exactly one remembered model.
    internal_model?: string;

    // `external` is kept as the mode flag for compatibility.
    external?: boolean;
    external_provider?: ExternalAiProvider;

    // Each external provider remembers its own URL/key/model.
    external_ollama?: OllamaExternalProviderConfig;
    external_openai?: OllamaExternalProviderConfig;

    // Legacy fields migrated automatically into external_ollama.
    external_model?: string;
    external_url?: string;
    api_key?: string;
};

export type Integrations = {
    twitch?: TwitchIntegration;
    wled?: Record<string, WledIntegration>;
    obs?: Record<string, ObsIntegration>;
    yolobox?: YoloboxIntegration;
    neopixel?: Record<string, NeopixelIntegration>;
    ollama?: OllamaIntegration;
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
        client_id: string;
        hasClientSecret: boolean;
        control: boolean;
        message: boolean;
    };
    wled: Record<string, WledIntegration>;
    obs: Record<string, SafeObsIntegration>;
    yolobox: SafeYoloboxIntegration;
    neopixel: Record<string, NeopixelIntegration>;
    ollama: {
        enabled: boolean;
        model: string;
        internal_model: string;
        external: boolean;
        external_provider: ExternalAiProvider;
        external_url: string;
        has_api_key: boolean;
        external_ollama: {
            url: string;
            model: string;
            has_api_key: boolean;
        };
        external_openai: {
            url: string;
            model: string;
            has_api_key: boolean;
        };
    };
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
    return loadIntegrationsCache();
}

export function writeIntegrations(data: Integrations) {
    const sanitized = sanitizeIntegrationsForDisk(data);
    integrationsCache = sanitized;

    fs.mkdirSync(path.dirname(integrationsPath), {recursive: true});
    fs.writeFileSync(integrationsPath, JSON.stringify(sanitized, null, 4), "utf8");
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
            client_id: integrations.twitch?.client_id ?? integrations.twitch?.clientId ?? "",
            hasClientSecret: Boolean(integrations.twitch?.client_secret ?? integrations.twitch?.clientSecret),
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
        ollama: (() => {
            const integration = getOllamaIntegration();
            const provider = integration.external_provider ?? "ollama";
            const activeExternalConfig =
                provider === "openai"
                    ? integration.external_openai
                    : integration.external_ollama;

            return {
                enabled: Boolean(integration.enabled),
                model: String(integration.model ?? ""),
                internal_model: String(integration.internal_model ?? ""),
                external: Boolean(integration.external),
                external_provider: provider,
                external_url: String(activeExternalConfig?.url ?? ""),
                has_api_key: Boolean(activeExternalConfig?.api_key),
                external_ollama: {
                    url: String(integration.external_ollama?.url ?? ""),
                    model: String(integration.external_ollama?.model ?? ""),
                    has_api_key: Boolean(integration.external_ollama?.api_key),
                },
                external_openai: {
                    url: String(integration.external_openai?.url ?? ""),
                    model: String(integration.external_openai?.model ?? ""),
                    has_api_key: Boolean(integration.external_openai?.api_key),
                },
            };
        })(),
    };
}

export function emitIntegrationsUpdate() {
    getWebsocketServer().send("notify_integrations_update", getIntegrationsSafe());
}


export function getTwitchIntegration() {
    return readIntegrations().twitch ?? {};
}

export function setTwitchClientIntegration(data: {client_id?: string; clientId?: string; client_secret?: string; clientSecret?: string}) {
    const clientId = String(data.client_id ?? data.clientId ?? "").trim();
    const clientSecret = String(data.client_secret ?? data.clientSecret ?? "").trim();

    if (!clientId) throw new Error("client_id is required");
    if (!clientSecret) throw new Error("client_secret is required");

    const integrations = readIntegrations();

    integrations.twitch ??= {};
    integrations.twitch.client_id = clientId;
    integrations.twitch.client_secret = clientSecret;

    delete integrations.twitch.clientId;
    delete integrations.twitch.clientSecret;

    writeIntegrations(integrations);
    emitIntegrationsUpdate();
}

export function clearTwitchAuth(type?: "control" | "message") {
    const integrations = readIntegrations();

    if (!integrations.twitch) return;

    if (!type || type === "control") {
        delete integrations.twitch.control;
    }

    if (!type || type === "message") {
        delete integrations.twitch.message;
    }

    writeIntegrations(integrations);
    emitIntegrationsUpdate();
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


function getDefaultOllamaIntegration(): OllamaIntegration {
    return {
        enabled: false,
        model: "",
        internal_model: "",
        external: false,
        external_provider: "ollama",
        external_ollama: {
            url: "",
            api_key: "",
            model: "",
        },
        external_openai: {
            url: "",
            api_key: "",
            model: "",
        },
    };
}

function getExternalProviderConfig(
    integration: OllamaIntegration,
    provider: ExternalAiProvider,
): OllamaExternalProviderConfig {
    if (provider === "openai") {
        integration.external_openai ??= {};
        return integration.external_openai;
    }

    integration.external_ollama ??= {};
    return integration.external_ollama;
}

function migrateOllamaIntegration(integration: OllamaIntegration): boolean {
    let changed = false;
    const activeModel = String(integration.model ?? "").trim();

    if (integration.internal_model === undefined) {
        integration.internal_model = integration.external ? "" : activeModel;
        changed = true;
    }

    if (
        integration.external_provider !== "ollama" &&
        integration.external_provider !== "openai"
    ) {
        integration.external_provider = "ollama";
        changed = true;
    }

    if (!integration.external_ollama) {
        integration.external_ollama = {};
        changed = true;
    }

    if (!integration.external_openai) {
        integration.external_openai = {};
        changed = true;
    }

    // Migrate the old single external Ollama fields into the new Ollama provider
    // config. Existing users therefore keep their current server/model/key.
    if (
        integration.external_url !== undefined &&
        integration.external_ollama.url === undefined
    ) {
        integration.external_ollama.url =
            String(integration.external_url ?? "").trim();
        changed = true;
    }

    if (
        integration.api_key !== undefined &&
        integration.external_ollama.api_key === undefined
    ) {
        integration.external_ollama.api_key =
            String(integration.api_key ?? "").trim();
        changed = true;
    }

    if (
        integration.external_model !== undefined &&
        integration.external_ollama.model === undefined
    ) {
        integration.external_ollama.model =
            String(integration.external_model ?? "").trim();
        changed = true;
    }

    if (
        integration.external &&
        integration.external_provider === "ollama" &&
        !String(integration.external_ollama.model ?? "").trim() &&
        activeModel
    ) {
        integration.external_ollama.model = activeModel;
        changed = true;
    }

    if (
        integration.external &&
        integration.external_provider === "openai" &&
        !String(integration.external_openai.model ?? "").trim() &&
        activeModel
    ) {
        integration.external_openai.model = activeModel;
        changed = true;
    }

    // Legacy fields are no longer written after migration.
    if (integration.external_model !== undefined) {
        delete integration.external_model;
        changed = true;
    }

    if (integration.external_url !== undefined) {
        delete integration.external_url;
        changed = true;
    }

    if (integration.api_key !== undefined) {
        delete integration.api_key;
        changed = true;
    }

    return changed;
}

export function getOllamaIntegration(): OllamaIntegration {
    const integrations = readIntegrations();

    if (!integrations.ollama) {
        return getDefaultOllamaIntegration();
    }

    if (migrateOllamaIntegration(integrations.ollama)) {
        writeIntegrations(integrations);
    }

    return integrations.ollama;
}

export function isOllamaIntegrationEnabled() {
    return Boolean(getOllamaIntegration().enabled);
}

export function ensureDefaultOllamaIntegration() {
    const integrations = readIntegrations();

    if (!integrations.ollama) {
        integrations.ollama = getDefaultOllamaIntegration();
        writeIntegrations(integrations);
        return integrations.ollama;
    }

    if (migrateOllamaIntegration(integrations.ollama)) {
        writeIntegrations(integrations);
    }

    return integrations.ollama;
}

export async function setOllamaIntegrationEnabled(enabled: boolean) {
    const integrations = readIntegrations();
    const previousEnabled = Boolean(integrations.ollama?.enabled);
    const nextEnabled = Boolean(enabled);

    integrations.ollama ??= getDefaultOllamaIntegration();
    migrateOllamaIntegration(integrations.ollama);
    integrations.ollama.enabled = nextEnabled;

    writeIntegrations(integrations);
    emitIntegrationsUpdate();

    const {syncOllamaIntegration} = await import("./OllamaHelper");

    await syncOllamaIntegration(nextEnabled && !previousEnabled);
}

export function setOllamaIntegrationModel(model: string) {
    const integrations = readIntegrations();

    integrations.ollama ??= getDefaultOllamaIntegration();
    migrateOllamaIntegration(integrations.ollama);

    const normalizedModel = String(model ?? "").trim();

    integrations.ollama.model = normalizedModel;

    if (integrations.ollama.external) {
        const provider = integrations.ollama.external_provider ?? "ollama";
        getExternalProviderConfig(
            integrations.ollama,
            provider,
        ).model = normalizedModel;
    } else {
        integrations.ollama.internal_model = normalizedModel;
    }

    writeIntegrations(integrations);
    emitIntegrationsUpdate();
}

export async function setOllamaExternalIntegration(data: {
    external?: boolean;
    provider?: ExternalAiProvider;
    external_url?: string;
    api_key?: string;
    clear_api_key?: boolean;
}) {
    const integrations = readIntegrations();

    integrations.ollama ??= getDefaultOllamaIntegration();
    migrateOllamaIntegration(integrations.ollama);

    const integration = integrations.ollama;
    const previousExternal = Boolean(integration.external);
    const previousProvider = integration.external_provider ?? "ollama";
    const external = Boolean(data.external);
    const provider: ExternalAiProvider =
        data.provider === "openai"
            ? "openai"
            : "ollama";

    const providerConfig = getExternalProviderConfig(
        integration,
        provider,
    );

    const externalUrl = String(
        data.external_url ??
        providerConfig.url ??
        "",
    ).trim().replace(/\/+$/, "");

    if (external && !externalUrl) {
        throw new Error("external AI server URL is required");
    }

    if (external && !/^https?:\/\//i.test(externalUrl)) {
        throw new Error("external AI server URL must start with http:// or https://");
    }

    const modeChanged =
        previousExternal !== external ||
        (
            external &&
            previousExternal &&
            previousProvider !== provider
        );

    const {
        stopOllama,
        syncOllamaIntegration,
    } = await import("./OllamaHelper");

    // Stop/unload the provider we are leaving before changing persisted mode/provider.
    if (
        modeChanged &&
        Boolean(integration.enabled)
    ) {
        await stopOllama();
    }

    // Remember the active model in the provider/mode we are leaving.
    const activeModel = String(integration.model ?? "").trim();

    if (previousExternal) {
        getExternalProviderConfig(
            integration,
            previousProvider,
        ).model = activeModel;
    } else {
        integration.internal_model = activeModel;
    }

    providerConfig.url = externalUrl;

    if (data.clear_api_key === true) {
        providerConfig.api_key = "";
    } else if (
        data.api_key !== undefined &&
        String(data.api_key).trim()
    ) {
        providerConfig.api_key =
            String(data.api_key).trim();
    }

    integration.external = external;
    integration.external_provider = provider;

    integration.model = String(
        external
            ? providerConfig.model ?? ""
            : integration.internal_model ?? "",
    ).trim();

    writeIntegrations(integrations);
    emitIntegrationsUpdate();

    await syncOllamaIntegration(false);
}

