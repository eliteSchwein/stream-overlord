import parseConfig from "js-conf-parser";
import TwitchClient from "../clients/twitch/Client";
import {logNotice, logRegular} from "./LogHelper";
import {existsSync, watchFile, writeFileSync} from "node:fs";
import {reload} from "../App";
import {readFileSync} from "fs";
import * as path from "node:path";
import * as os from "node:os";

let config = {};
let primaryChannel = undefined;

type StreambotSettings = {
    language: string;
};

let settings: StreambotSettings = {
    language: "en"
};

const settingsPath = path.resolve(os.homedir(), "streambot-settings.json");

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

export function readSettings() {
    if (!existsSync(settingsPath)) {
        settings = {
            language: detectSystemLanguage()
        };

        writeSettings(settings);
        return settings;
    }

    try {
        const raw = readFileSync(settingsPath, "utf8");
        const parsed = JSON.parse(raw);

        settings = {
            language: parsed.language || detectSystemLanguage()
        };

        writeSettings(settings);
    } catch {
        settings = {
            language: detectSystemLanguage()
        };

        writeSettings(settings);
    }

    return settings;
}

export function writeSettings(newSettings: Partial<StreambotSettings>) {
    settings = {
        ...settings,
        ...newSettings
    };

    writeFileSync(
        settingsPath,
        JSON.stringify(settings, null, 2),
        "utf8"
    );

    return settings;
}

export function updateSettings(newSettings: Partial<StreambotSettings>) {
    return writeSettings(newSettings);
}

export function getSettings() {
    return settings;
}

export function getLanguage() {
    return settings.language;
}

export default function readConfig(standalone = false) {
    if (standalone) return parseConfig(`${__dirname}/../..`, ".env.conf");

    config = parseConfig(`${__dirname}/../..`, ".env.conf");
    readSettings();
}

export function getRawConfig() {
    return {
        raw: readFileSync(path.resolve(`${__dirname}/../..`, ".env.conf"), "utf8"),
        parsed: config
    };
}

export function writeRawConfig(content: string) {
    writeFileSync(path.resolve(`${__dirname}/../..`, ".env.conf"), content, "utf8");
}

export function getConfig(filter: RegExp | undefined = undefined, asObject = false) {
    if (!filter) return config;

    const result: any = [];

    for (const key in config) {
        if (!key.match(filter)) {
            continue;
        }

        if (asObject) {
            const realKey = key.replace(filter, "");
            result[realKey] = config[key];
        } else {
            result.push(config[key]);
        }
    }

    return result;
}

export function getFullConfig() {
    return config;
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
    logRegular("watch config file");

    watchFile(
        `${__dirname}/../../.env.conf`,
        {
            persistent: true,
            interval: 100
        },
        async () => {
            logNotice("config update detected");
            await reload();
        }
    );
}