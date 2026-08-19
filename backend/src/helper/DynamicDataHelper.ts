import * as fs from "node:fs/promises";
import * as path from "node:path";
import getWebsocketServer from "../App";
import {redis} from "../clients/redis/Redis";
import {logRegular, logWarn} from "./LogHelper";

export type DynamicData = {
    alert_channels: string[];
    media_targets: string[];
    animation_targets: string[];
    timer_names: string[];
};

const REDIS_KEY = "dynamic_data";

const EMPTY_DYNAMIC_DATA: DynamicData = {
    alert_channels: [],
    media_targets: [],
    animation_targets: [],
    timer_names: [],
};

let dynamicData: DynamicData = cloneDynamicData(EMPTY_DYNAMIC_DATA);
let initialized = false;

function cloneDynamicData(data: DynamicData): DynamicData {
    return {
        alert_channels: [...data.alert_channels],
        media_targets: [...data.media_targets],
        animation_targets: [...data.animation_targets],
        timer_names: [...data.timer_names],
    };
}

function normalizeValues(values: Iterable<string>) {
    return [...new Set(
        [...values]
            .map(value => String(value ?? "").trim())
            .filter(Boolean),
    )].sort((a, b) => a.localeCompare(b));
}

function normalizeDynamicData(value: any): DynamicData {
    return {
        alert_channels: normalizeValues(
            Array.isArray(value?.alert_channels) ? value.alert_channels : [],
        ),
        media_targets: normalizeValues(
            Array.isArray(value?.media_targets) ? value.media_targets : [],
        ),
        animation_targets: normalizeValues(
            Array.isArray(value?.animation_targets) ? value.animation_targets : [],
        ),
        timer_names: normalizeValues(
            Array.isArray(value?.timer_names) ? value.timer_names : [],
        ),
    };
}

async function findHtmlFiles(
    directory: string,
    rootDirectory: string = directory,
): Promise<string[]> {
    const resolvedDirectory = path.resolve(directory);
    const resolvedRoot = path.resolve(rootDirectory);

    let entries: import("node:fs").Dirent[];

    try {
        entries = await fs.readdir(resolvedDirectory, {withFileTypes: true});
    } catch (error) {
        return [];
    }

    const files: string[] = [];

    // Deliberately recurse into every directory below the template root.
    // This is not limited to configured/pre-cached templates.
    for (const entry of entries) {
        const fullPath = path.join(resolvedDirectory, entry.name);

        if (entry.isDirectory()) {
            files.push(...await findHtmlFiles(fullPath, resolvedRoot));
            continue;
        }

        if (!entry.isFile()) {
            continue;
        }

        if (entry.name.toLowerCase().endsWith(".html")) {
            files.push(fullPath);
        }
    }

    return files;
}

function collectAttributeValues(
    html: string,
    attribute: string,
    target: Set<string>,
    filePath: string,
    templateRoot: string,
) {
    const escapedAttribute = attribute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(
        `${escapedAttribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
        "gi",
    );

    for (const match of html.matchAll(regex)) {
        const value = String(match[1] ?? match[2] ?? match[3] ?? "").trim();

        if (!value) {
            continue;
        }

        target.add(value);
    }
}

async function parseDynamicData(templateRoot: string): Promise<DynamicData> {
    const resolvedRoot = path.resolve(templateRoot);

    const alertChannels = new Set<string>();
    const mediaTargets = new Set<string>();
    const animationTargets = new Set<string>();
    const timerNames = new Set<string>();

    const files = await findHtmlFiles(resolvedRoot, resolvedRoot);

    await Promise.all(
        files.map(async filePath => {
            let html: string;

            try {
                html = await fs.readFile(filePath, "utf8");
            } catch (error) {
                logWarn(
                    `failed to read dynamic data template ${filePath}: ${
                        error instanceof Error ? error.message : String(error)
                    }`,
                );
                return;
            }

            collectAttributeValues(
                html,
                "data-alert-channel",
                alertChannels,
                filePath,
                resolvedRoot,
            );

            collectAttributeValues(
                html,
                "data-media-target",
                mediaTargets,
                filePath,
                resolvedRoot,
            );

            collectAttributeValues(
                html,
                "data-target",
                animationTargets,
                filePath,
                resolvedRoot,
            );

            collectAttributeValues(
                html,
                "data-timer-name",
                timerNames,
                filePath,
                resolvedRoot,
            );
        }),
    );

    const result: DynamicData = {
        alert_channels: normalizeValues(alertChannels),
        media_targets: normalizeValues(mediaTargets),
        animation_targets: normalizeValues(animationTargets),
        timer_names: normalizeValues(timerNames),
    };

    return result;
}

async function loadRedisCache(): Promise<DynamicData | null> {
    if (!redis.isReady()) {
        return null;
    }

    try {
        const cached = await redis.getVariable(REDIS_KEY);

        if (!cached) {
            return null;
        }

        return normalizeDynamicData(JSON.parse(cached));
    } catch (error) {
        logWarn("loading dynamic data cache failed:");
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        return null;
    }
}

async function saveRedisCache(data: DynamicData) {
    if (!redis.isReady()) {
        return;
    }

    try {
        await redis.setVariable(REDIS_KEY, JSON.stringify(data));
    } catch (error) {
        logWarn("saving dynamic data cache failed:");
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
}

export function getDynamicData(): DynamicData {
    return cloneDynamicData(dynamicData);
}

export function notifyDynamicDataUpdate(client?: any) {
    try {
        getWebsocketServer()?.send(
            "notify_dynamic_data_update",
            {
                dynamic_data: getDynamicData(),
            },
            client,
        );
    } catch {
        // Websocket server may not exist during very early startup.
    }
}

export async function initDynamicData(templateRoot: string) {
    if (initialized) {
        notifyDynamicDataUpdate();
        return getDynamicData();
    }

    // Load Redis first as a warm value so connected clients can receive
    // something immediately, but do not trust it as the authoritative source
    // forever. We always scan every template once per backend start.
    const cached = await loadRedisCache();

    if (cached) {
        dynamicData = cached;
        notifyDynamicDataUpdate();
    }

    return await refreshDynamicData(templateRoot);
}

export async function refreshDynamicData(templateRoot: string) {
    logRegular("scan dynamic template data");

    dynamicData = await parseDynamicData(templateRoot);
    initialized = true;

    await saveRedisCache(dynamicData);
    notifyDynamicDataUpdate();

    return getDynamicData();
}

export async function clearDynamicDataCache() {
    initialized = false;
    dynamicData = cloneDynamicData(EMPTY_DYNAMIC_DATA);

    if (redis.isReady()) {
        await redis.deleteVariable(REDIS_KEY);
    }

    notifyDynamicDataUpdate();
}
