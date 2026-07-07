import parseConfig from "js-conf-parser";
import TwitchClient from "../clients/twitch/Client";
import {logError, logNotice, logRegular, logWarn} from "./LogHelper";
import {existsSync, mkdirSync, readFileSync, watchFile, writeFileSync} from "node:fs";
import {reload} from "../App";
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

type StreambotSettings = {
    language: string;
    asset_tune: AssetTuneSettings;
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

let systemConfig: StreambotSettings = {
    language: "en",
    asset_tune: defaultAssetTuneSettings,
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

function normalizeSystemConfig(rawSystemConfig: Partial<StreambotSettings> = {}): StreambotSettings {
    const language = rawSystemConfig.language?.trim().toLowerCase() || detectSystemLanguage();

    return {
        language,
        asset_tune: normalizeAssetTuneSettings(rawSystemConfig.asset_tune),
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
        ...newSystemConfig
    });

    writeSystemConfigFile(systemConfig);

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
        asset_tune: {
            ...systemConfig.asset_tune,
            ...newAssetTuneSettings,
        },
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
