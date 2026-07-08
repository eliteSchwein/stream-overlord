import parseConfig from "js-conf-parser";
import TwitchClient from "../clients/twitch/Client";
import {logError, logNotice, logRegular, logWarn} from "./LogHelper";
import {existsSync, mkdirSync, readFileSync, watchFile, writeFileSync} from "node:fs";
import getWebsocketServer, {reload} from "../App";
import * as path from "node:path";
import * as os from "node:os";

let config: any = {};
let primaryChannel: any = undefined;
let configWatcherRegistered = false;
let reloadTimer: NodeJS.Timeout | undefined;

export type AssetTuneCodec = "vp9" | "av1";

export type AssetTuneSettings = {
    ffmpeg_bin: string;
    ffprobe_bin: string;
    codec: AssetTuneCodec;
    image_compress_level: number;
    image_compress_percent: number;
    audio_bitrate: string;
    disable_nv: boolean;
    disable_amf: boolean;
    disable_qsv: boolean;
    disable_vaapi: boolean;
};

export type TtsSettings = {
    model: string;
};

export type ThemeSettings = {
    default_color: string;
};

export type CavaTargetSettings = Record<string, string | number | boolean>;

export type CavaSettings = {
    bars: number;
    input: {
        source: string;
    };
    output: {
        channels: string;
    };
    targets: Record<string, CavaTargetSettings>;
};

type StreambotSettings = {
    language: string;
    asset_tune: AssetTuneSettings;
    tts: TtsSettings;
    theme: ThemeSettings;
    cava: CavaSettings;
};

const defaultAssetTuneSettings: AssetTuneSettings = {
    ffmpeg_bin: "ffmpeg",
    ffprobe_bin: "ffprobe",
    codec: "vp9",
    image_compress_level: 6,
    image_compress_percent: 80,
    audio_bitrate: "128k",
    disable_nv: false,
    disable_amf: false,
    disable_qsv: false,
    disable_vaapi: false,
};

const defaultTtsSettings: TtsSettings = {
    model: "de_DE-thorsten-medium",
};

const defaultThemeSettings: ThemeSettings = {
    default_color: "ff9800",
};

const defaultCavaSettings: CavaSettings = {
    bars: 36,
    input: {
        source: "streambot_cava.monitor",
    },
    output: {
        channels: "mono",
    },
    targets: {},
};

let systemConfig: StreambotSettings = {
    language: "en",
    asset_tune: defaultAssetTuneSettings,
    tts: defaultTtsSettings,
    theme: defaultThemeSettings,
    cava: defaultCavaSettings,
};

const systemConfigDir = path.resolve(os.homedir(), ".config/streambot");
const systemConfigPath = path.resolve(systemConfigDir, "streambot-settings.json");

function detectSystemLanguage() {
    return (
        process.env.LC_ALL ||
        process.env.LC_MESSAGES ||
        process.env.LANG ||
        process.env.LANGUAGE ||
        "en"
    )
        .split(".")[0]
        .split("_")[0]
        .split(":")[0]
        .toLowerCase();
}

function ensureSystemConfigDir() {
    mkdirSync(systemConfigDir, {recursive: true});
}

function serializeSystemConfig(configToSerialize: StreambotSettings) {
    return `${JSON.stringify(configToSerialize, null, 2)}\n`;
}

export function getSystemConfigDirectory() {
    return systemConfigDir;
}

function writeSystemConfigFile(configToWrite: StreambotSettings) {
    ensureSystemConfigDir();

    const content = serializeSystemConfig(configToWrite);

    if (existsSync(systemConfigPath)) {
        try {
            if (readFileSync(systemConfigPath, "utf8") === content) {
                return;
            }
        } catch {
            // If reading fails, fall through and try to write the normalized config.
        }
    }

    writeFileSync(systemConfigPath, content, "utf8");
}

function scheduleReload() {
    if (reloadTimer) {
        clearTimeout(reloadTimer);
    }

    reloadTimer = setTimeout(async () => {
        reloadTimer = undefined;
        await reload();
    }, 250);
}

function normalizeAssetTuneSettings(rawAssetTuneSettings: Partial<AssetTuneSettings> = {}): AssetTuneSettings {
    const codec = String(rawAssetTuneSettings.codec || defaultAssetTuneSettings.codec)
        .trim()
        .toLowerCase();

    return {
        ffmpeg_bin: stringSetting(rawAssetTuneSettings.ffmpeg_bin, defaultAssetTuneSettings.ffmpeg_bin),
        ffprobe_bin: stringSetting(rawAssetTuneSettings.ffprobe_bin, defaultAssetTuneSettings.ffprobe_bin),
        codec: codec === "av1" ? "av1" : "vp9",
        image_compress_level: numberSetting(rawAssetTuneSettings.image_compress_level, defaultAssetTuneSettings.image_compress_level),
        image_compress_percent: numberSetting(rawAssetTuneSettings.image_compress_percent, defaultAssetTuneSettings.image_compress_percent),
        audio_bitrate: stringSetting(rawAssetTuneSettings.audio_bitrate, defaultAssetTuneSettings.audio_bitrate),
        disable_nv: booleanSetting(rawAssetTuneSettings.disable_nv, defaultAssetTuneSettings.disable_nv),
        disable_amf: booleanSetting(rawAssetTuneSettings.disable_amf, defaultAssetTuneSettings.disable_amf),
        disable_qsv: booleanSetting(rawAssetTuneSettings.disable_qsv, defaultAssetTuneSettings.disable_qsv),
        disable_vaapi: booleanSetting(rawAssetTuneSettings.disable_vaapi, defaultAssetTuneSettings.disable_vaapi),
    };
}

function normalizeTtsSettings(rawTtsSettings: Partial<TtsSettings> = {}): TtsSettings {
    return {
        model: normalizeTtsModel(rawTtsSettings.model),
    };
}

function normalizeTtsModel(value: unknown): string {
    const model = stringSetting(value, defaultTtsSettings.model);

    return model.endsWith(".onnx") ? model.slice(0, -5) : model;
}

function normalizeThemeSettings(rawThemeSettings: Partial<ThemeSettings> = {}): ThemeSettings {
    return {
        default_color: normalizeHexColor(rawThemeSettings.default_color, defaultThemeSettings.default_color),
    };
}


function normalizeCavaTargetSettings(rawTargetSettings: Record<string, unknown> = {}): CavaTargetSettings {
    const target: CavaTargetSettings = {};

    for (const key in rawTargetSettings) {
        const normalizedKey = String(key).trim();

        if (!normalizedKey) continue;

        const value = rawTargetSettings[key];

        if (value === undefined || value === null || value === "") continue;

        if (typeof value === "boolean" || typeof value === "number") {
            target[normalizedKey] = value;
            continue;
        }

        if (typeof value === "string") {
            const trimmed = value.trim();
            const lower = trimmed.toLowerCase();

            if (["true", "1", "yes", "on"].includes(lower)) {
                target[normalizedKey] = true;
                continue;
            }

            if (["false", "0", "no", "off"].includes(lower)) {
                target[normalizedKey] = false;
                continue;
            }

            const numericValue = Number(trimmed);

            target[normalizedKey] = Number.isFinite(numericValue) ? numericValue : trimmed;
        }
    }

    if (target.enabled === undefined) {
        target.enabled = true;
    }

    if (target.bars === undefined) {
        target.bars = defaultCavaSettings.bars;
    }

    return target;
}

function normalizeCavaSettings(rawCavaSettings: Partial<CavaSettings> = {}): CavaSettings {
    const rawTargets = rawCavaSettings.targets && typeof rawCavaSettings.targets === "object"
        ? rawCavaSettings.targets
        : {};

    const targets: Record<string, CavaTargetSettings> = {};

    for (const key in rawTargets) {
        const normalizedKey = String(key).trim();

        if (!normalizedKey) continue;

        targets[normalizedKey] = normalizeCavaTargetSettings(rawTargets[key]);
    }

    return {
        bars: numberSetting(rawCavaSettings.bars, defaultCavaSettings.bars),
        input: {
            source: stringSetting(rawCavaSettings.input?.source, defaultCavaSettings.input.source),
        },
        output: {
            channels: stringSetting(rawCavaSettings.output?.channels, defaultCavaSettings.output.channels),
        },
        targets,
    };
}

function normalizeHexColor(value: unknown, fallback: string): string {
    const raw = stringSetting(value, fallback)
        .replace(/^#/, "")
        .trim()
        .toLowerCase();

    if (/^[0-9a-f]{3}$/i.test(raw) || /^[0-9a-f]{6}$/i.test(raw)) {
        return raw;
    }

    return fallback;
}

function normalizeSystemConfig(rawSystemConfig: Partial<StreambotSettings> = {}): StreambotSettings {
    const language = rawSystemConfig.language?.trim().toLowerCase() || detectSystemLanguage();

    return {
        language,
        asset_tune: normalizeAssetTuneSettings(rawSystemConfig.asset_tune),
        tts: normalizeTtsSettings(rawSystemConfig.tts),
        theme: normalizeThemeSettings(rawSystemConfig.theme),
        cava: normalizeCavaSettings(rawSystemConfig.cava),
    };
}

function stringSetting(value: unknown, fallback: string): string {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberSetting(value: unknown, fallback: number): number {
    const n = Number(value);

    return Number.isFinite(n) ? n : fallback;
}

function booleanSetting(value: unknown, fallback: boolean): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();

        if (["true", "1", "yes", "on"].includes(normalized)) return true;
        if (["false", "0", "no", "off"].includes(normalized)) return false;
    }

    return fallback;
}

function withSystemConfig<T extends object>(parsedConfig: T): T & { system_config: StreambotSettings } {
    return {
        ...parsedConfig,
        system_config: systemConfig
    };
}

function emitSettingsUpdate() {
    getWebsocketServer().send("notify_settings_update", getSettings());
}

export function readSystemConfig() {
    if (!existsSync(systemConfigPath)) {
        systemConfig = normalizeSystemConfig();
        writeSystemConfigFile(systemConfig);
        return systemConfig;
    }

    try {
        const raw = readFileSync(systemConfigPath, "utf8");
        const parsed = JSON.parse(raw);

        systemConfig = normalizeSystemConfig(parsed);

        // Only repair the file when a required value is missing/invalid.
        // Do not rewrite on every read, otherwise watchFile sees our own read-normalize-write
        // cycle as another change and reloads forever.
        if (serializeSystemConfig(parsed) !== serializeSystemConfig(systemConfig)) {
            writeSystemConfigFile(systemConfig);
        }
    } catch {
        systemConfig = normalizeSystemConfig();
        writeSystemConfigFile(systemConfig);
    }

    return systemConfig;
}

export function writeSystemConfig(newSystemConfig: Partial<StreambotSettings>) {
    systemConfig = normalizeSystemConfig({
        ...systemConfig,
        ...newSystemConfig,
        asset_tune: {
            ...systemConfig.asset_tune,
            ...newSystemConfig.asset_tune,
        },
        tts: {
            ...systemConfig.tts,
            ...newSystemConfig.tts,
        },
        theme: {
            ...systemConfig.theme,
            ...newSystemConfig.theme,
        },
        cava: newSystemConfig.cava
            ? {
                ...systemConfig.cava,
                ...newSystemConfig.cava,
                input: {
                    ...systemConfig.cava.input,
                    ...newSystemConfig.cava.input,
                },
                output: {
                    ...systemConfig.cava.output,
                    ...newSystemConfig.cava.output,
                },
                // Important: targets must be replaced, not merged.
                // Otherwise deleted frontend targets are merged back from the old settings object.
                targets: newSystemConfig.cava.targets !== undefined
                    ? newSystemConfig.cava.targets
                    : systemConfig.cava.targets,
            }
            : systemConfig.cava,
    });

    writeSystemConfigFile(systemConfig);

    emitSettingsUpdate()

    return systemConfig;
}

export function updateSystemConfig(newSystemConfig: Partial<StreambotSettings>) {
    return writeSystemConfig(newSystemConfig);
}

export function setSystemLanguage(language: string) {
    const normalizedLanguage = language.trim().toLowerCase();

    if (!normalizedLanguage) {
        throw new Error("language is required");
    }

    return writeSystemConfig({
        language: normalizedLanguage
    });
}

export function getSystemConfig() {
    return systemConfig;
}

export function getLanguage() {
    return systemConfig.language;
}

export function getAssetTuneSettings() {
    return systemConfig.asset_tune;
}

export function updateAssetTuneSettings(newAssetTuneSettings: Partial<AssetTuneSettings>) {
    return writeSystemConfig({
        asset_tune: newAssetTuneSettings as AssetTuneSettings,
    });
}

export function getTtsSettings() {
    return systemConfig.tts;
}

export function updateTtsSettings(newTtsSettings: Partial<TtsSettings>) {
    return writeSystemConfig({
        tts: {
            ...systemConfig.tts,
            ...newTtsSettings,
        },
    });
}

export function getThemeSettings() {
    return systemConfig.theme;
}

export function updateThemeSettings(newThemeSettings: Partial<ThemeSettings>) {
    return writeSystemConfig({
        theme: {
            ...systemConfig.theme,
            ...newThemeSettings,
        },
    });
}

export function getCavaSettings() {
    return systemConfig.cava;
}

export function updateCavaSettings(newCavaSettings: Partial<CavaSettings>) {
    return writeSystemConfig({
        cava: newCavaSettings as CavaSettings,
    });
}

export default function readConfig(standalone = false) {
    if (standalone) {
        let standaloneConfig = {}
        try {
            standaloneConfig = parseConfig(`${__dirname}/../..`, ".env.conf");
        } catch (error) {
            logNotice('env config load failed:')
            logNotice(JSON.stringify(error, Object.getOwnPropertyNames(error)))
        }
        readSystemConfig();
        return withSystemConfig(standaloneConfig);
    }

    try {
        config = parseConfig(`${__dirname}/../..`, ".env.conf");
    } catch (error) {
        logNotice('env config load failed:')
        logNotice(JSON.stringify(error, Object.getOwnPropertyNames(error)))
    }
    readSystemConfig();

    return withSystemConfig(config);
}

export function getRawConfig() {
    return {
        raw: readFileSync(path.resolve(`${__dirname}/../..`, ".env.conf"), "utf8"),
        parsed: withSystemConfig(config),
        system_config: systemConfig
    };
}

export function writeRawConfig(content: string) {
    writeFileSync(path.resolve(`${__dirname}/../..`, ".env.conf"), content, "utf8");
}

export function getConfig(filter: RegExp | undefined = undefined, asObject = false) {
    const mergedConfig = withSystemConfig(config);

    if (!filter) return mergedConfig;

    const result: any = asObject ? {} : [];

    for (const key in mergedConfig) {
        if (!key.match(filter)) {
            continue;
        }

        if (asObject) {
            const realKey = key.replace(filter, "");
            result[realKey] = mergedConfig[key];
        } else {
            result.push(mergedConfig[key]);
        }
    }

    return result;
}

export function getFullConfig() {
    return withSystemConfig(config);
}

export async function loadPrimaryChannel(client: TwitchClient) {
    logRegular("fetch primary channel");

    primaryChannel = await client.getBot().api.users.getUserByName(
        getConfig(/twitch/g)[0]["channels"][0]
    );
}

export function getPrimaryChannel() {
    return primaryChannel;
}

export function getParsedPrimaryChannel() {
    const channel: any = primaryChannel;

    if (!channel) {
        return undefined;
    }

    return {
        id: channel.id,
        name: channel.name,
        display_name: channel.displayName,
        description: channel.description,
        profile_picture_url: channel.profilePictureUrl,
        offline_placeholder_url: channel.offlinePlaceholderUrl,
        creation_date: channel.creationDate?.toISOString?.() ?? channel.creationDate,
        type: channel.type,
        broadcaster_type: channel.broadcasterType,
    };
}

export function watchConfig() {
    if (configWatcherRegistered) {
        return;
    }

    configWatcherRegistered = true;

    logRegular("watch config file");

    // Make sure the settings file exists before watchFile is registered.
    // Otherwise the first auto-created file can immediately trigger the watcher.
    readSystemConfig();

    watchFile(
        `${__dirname}/../../.env.conf`,
        {
            persistent: true,
            interval: 250
        },
        (curr, prev) => {
            if (curr.mtimeMs === prev.mtimeMs) {
                return;
            }

            logNotice("config update detected");
            scheduleReload();
        }
    );

    watchFile(
        systemConfigPath,
        {
            persistent: true,
            interval: 250
        },
        (curr, prev) => {
            if (curr.mtimeMs === prev.mtimeMs) {
                return;
            }

            logNotice("system config update detected");
            readSystemConfig();
            scheduleReload();
        }
    );
}

// Backwards-compatible aliases for existing imports.
export const readSettings = readSystemConfig;
export const writeSettings = writeSystemConfig;
export const updateSettings = updateSystemConfig;
export const getSettings = getSystemConfig;
