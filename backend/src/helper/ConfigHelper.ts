import parseConfig from "js-conf-parser";
import TwitchClient from "../clients/twitch/Client";
import {logNotice, logRegular} from "./LogHelper";
import {existsSync, mkdirSync, readFileSync, watchFile, writeFileSync} from "node:fs";
import {reload} from "../App";
import * as path from "node:path";
import * as os from "node:os";

let config: any = {};
let primaryChannel = undefined;
let configWatcherRegistered = false;
let reloadTimer: NodeJS.Timeout | undefined;

type StreambotSettings = {
    language: string;
};

let systemConfig: StreambotSettings = {
    language: "en"
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

function normalizeSystemConfig(rawSystemConfig: Partial<StreambotSettings> = {}): StreambotSettings {
    const language = rawSystemConfig.language?.trim().toLowerCase() || detectSystemLanguage();

    return {
        language
    };
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
        if (typeof parsed?.language !== "string" || parsed.language.trim() !== systemConfig.language) {
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

export default function readConfig(standalone = false) {
    if (standalone) {
        const standaloneConfig = parseConfig(`${__dirname}/../..`, ".env.conf");
        readSystemConfig();
        return withSystemConfig(standaloneConfig);
    }

    config = parseConfig(`${__dirname}/../..`, ".env.conf");
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

export function getAssetConfig(asset: string) {
    return getConfig(/asset /g, true)[asset];
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
