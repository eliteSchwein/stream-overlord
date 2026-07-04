import * as fs from "node:fs";
import * as path from "node:path";
import * as yaml from "js-yaml";
import {getPrimaryChannel, getSystemConfigDirectory} from "./ConfigHelper";
import getWebsocketServer, {getTwitchClient} from "../App";
import {HelixCustomReward, HelixUser} from "@twurple/api";
import {logRegular, logWarn} from "./LogHelper";
import {getGameInfoData} from "../clients/website/WebsiteClient";
import {emitSystemStorageUpdate} from "./SystemStorageHelper";

let channelPoints: Record<string, HelixCustomReward> = {};
let activeChannelPoints: any[] = [];
let allChannelPoints: any[] = [];
let gameMacros: any = {};
let configuredChannelPoints: Record<string, any> = {};

const CHANNEL_POINT_CONFIG_FILE_EXTENSIONS = [".yaml", ".yml", ".json"];

export type ChannelPointConfig = {
    label?: string;
    name?: string;
    asset: string;
    macro: string;
    auto_accept?: boolean;
    strip_emotes?: boolean;
    input_required?: boolean;
    enable_default?: boolean;
    cost?: number;
    [key: string]: any;
};

export type ChannelPointConfigFileEntry = {
    name: string;
    path: string;
    type: "file";
    extension?: string;
};

function normalizeChannelPointKey(value: unknown): string {
    return typeof value === "string"
        ? value.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_.-]+/g, "_").replace(/^_+|_+$/g, "")
        : "";
}

function normalizeChannelPointLookup(value: unknown): string {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function coerceChannelPointBoolean(value: unknown): boolean {
    if (value === true) return true;
    if (value === 1) return true;

    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
    }

    return false;
}

function hasOwnValue(object: any, key: string) {
    return Object.prototype.hasOwnProperty.call(object ?? {}, key) && object?.[key] !== undefined;
}

function getChannelPointConfigLogName(config: any = {}) {
    return String(config?.label ?? config?.name ?? config?.twitch_label ?? config?.twitch_name ?? config?.title ?? "").trim();
}

function getChannelPointConfigLogSource(config: any = {}) {
    return String(config?.file ?? config?.source ?? "game").trim();
}

function logChannelPointConfigSummary(prefix: string, configs: any[] = []) {
    const names = configs
        .map(config => getChannelPointConfigLogName(config))
        .filter(Boolean);

    logRegular(`${prefix}: ${configs.length}${names.length ? ` (${names.join(", ")})` : ""}`);
}

function logChannelPointDiffSummary(prefix: string, points: any[] = []) {
    const names = points
        .map(point => String(point?.title ?? point?.label ?? point?.name ?? "").trim())
        .filter(Boolean);

    logRegular(`${prefix}: ${points.length}${names.length ? ` (${names.join(", ")})` : ""}`);
}

export function getChannelPointConfigDirectory() {
    return path.join(getSystemConfigDirectory(), "channel_points");
}

function ensureChannelPointConfigDirectory() {
    fs.mkdirSync(getChannelPointConfigDirectory(), {recursive: true});
}

function isChannelPointConfigFile(filePath: string) {
    return CHANNEL_POINT_CONFIG_FILE_EXTENSIONS.includes(path.extname(filePath).toLowerCase());
}

function getChannelPointNameFromConfigFile(filePath: string) {
    return path.basename(filePath, path.extname(filePath));
}

function sanitizeChannelPointConfigFileName(name: string) {
    return String(name)
            .trim()
            .replace(/[\/\\]+/g, "_")
            .replace(/[^a-zA-Z0-9_.-]+/g, "_")
            .replace(/^\.+/, "")
        || "channel_point";
}

function getChannelPointConfigFilePathForName(name: string) {
    return path.join(getChannelPointConfigDirectory(), `${sanitizeChannelPointConfigFileName(name)}.yaml`);
}

function getChannelPointConfigFiles(): string[] {
    ensureChannelPointConfigDirectory();

    return fs.readdirSync(getChannelPointConfigDirectory(), {withFileTypes: true})
        .filter(entry => entry.isFile() && isChannelPointConfigFile(entry.name))
        .map(entry => path.join(getChannelPointConfigDirectory(), entry.name));
}

function parseChannelPointConfigContent(filePath: string, content: string) {
    const extension = path.extname(filePath).toLowerCase();

    if (extension === ".json") {
        return JSON.parse(content);
    }

    return yaml.load(content) ?? {};
}

function readChannelPointConfigFile(filePath: string) {
    return parseChannelPointConfigContent(filePath, fs.readFileSync(filePath, "utf8"));
}

function normalizeChannelPointConfig(name: string, config: any = {}): ChannelPointConfig {
    const label = String(config?.label ?? config?.name ?? name).trim();

    return {
        ...config,
        label,
        name: label,
        asset: String(config?.asset ?? "").trim(),
        macro: String(config?.macro ?? "").trim(),
        enable_default: coerceChannelPointBoolean(config?.enable_default),
        auto_accept: coerceChannelPointBoolean(config?.auto_accept),
        strip_emotes: coerceChannelPointBoolean(config?.strip_emotes),
        input_required: coerceChannelPointBoolean(config?.input_required ?? config?.inputRequired),
    };
}

export function loadChannelPointConfigs() {
    configuredChannelPoints = {};

    const configFiles = getChannelPointConfigFiles();

    logRegular(`detect channel point config files: ${configFiles.length}`);

    for (const filePath of configFiles) {
        const relativeFilePath = path.relative(getChannelPointConfigDirectory(), filePath).replace(/\\/g, "/");

        try {
            const rawConfig = readChannelPointConfigFile(filePath) as any;
            const channelPointName = rawConfig?.label ?? rawConfig?.name ?? getChannelPointNameFromConfigFile(filePath);

            if (!channelPointName) {
                logWarn(`skip channel point config ${relativeFilePath}: missing label/name`);
                continue;
            }

            const config = normalizeChannelPointConfig(channelPointName, rawConfig);

            configuredChannelPoints[config.label] = {
                ...config,
                file: relativeFilePath,
            };

            logRegular(`detected channel point config ${config.label} from ${relativeFilePath} (asset=${config.asset || "-"}, macro=${config.macro || "-"}, default=${config.enable_default ? "yes" : "no"}, input=${config.input_required ? "yes" : "no"})`);
        } catch (error) {
            logWarn(`failed to load channel point config file ${relativeFilePath}:`);
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        }
    }

    logChannelPointConfigSummary("loaded channel point configs", Object.values(configuredChannelPoints));
}

export function getConfiguredChannelPoints() {
    if (!Object.keys(configuredChannelPoints).length) {
        loadChannelPointConfigs();
    }

    return Object.values(configuredChannelPoints);
}

export function getConfiguredChannelPoint(label: string) {
    if (!Object.keys(configuredChannelPoints).length) {
        loadChannelPointConfigs();
    }

    return configuredChannelPoints[label];
}

function normalizeChannelPointConfigFileName(inputPathOrName: string = "") {
    const normalized = String(inputPathOrName || "")
        .replace(/\\/g, "/")
        .replace(/^([/\\])+/, "")
        .replace(/^channel_points\//, "")
        .trim();

    if (!normalized || normalized === "." || normalized === "channel_points") {
        return "";
    }

    if (normalized.includes("/") || normalized.split(path.sep).includes("..") || normalized.includes("..")) {
        throw new Error("folders are not supported for channel point configs");
    }

    return normalized;
}

function resolveChannelPointConfigFilePath(inputPathOrName: string = "") {
    ensureChannelPointConfigDirectory();

    const fileName = normalizeChannelPointConfigFileName(inputPathOrName);

    if (!fileName) {
        return getChannelPointConfigDirectory();
    }

    const resolvedPath = path.resolve(getChannelPointConfigDirectory(), fileName);
    const directory = getChannelPointConfigDirectory();

    if (resolvedPath === directory || !resolvedPath.startsWith(`${directory}${path.sep}`)) {
        throw new Error("invalid channel point config file");
    }

    return resolvedPath;
}

function relativeChannelPointConfigPath(filePath: string) {
    return path.relative(getChannelPointConfigDirectory(), filePath).replace(/\\/g, "/");
}

function findChannelPointConfigFileByName(name: string): string | undefined {
    ensureChannelPointConfigDirectory();

    for (const filePath of getChannelPointConfigFiles()) {
        try {
            const channelPointConfig = readChannelPointConfigFile(filePath) as any;
            const channelPointName = channelPointConfig?.label ?? channelPointConfig?.name ?? getChannelPointNameFromConfigFile(filePath);

            if (channelPointName === name || getChannelPointNameFromConfigFile(filePath) === name) {
                return filePath;
            }
        } catch (error) {
            logRegular(`failed to inspect channel point config file ${filePath}`);
        }
    }

    return undefined;
}

function resolveExistingChannelPointConfigFile(inputPathOrName: string = "") {
    if (!inputPathOrName) {
        throw new Error("channel point config path or name is required");
    }

    const normalized = normalizeChannelPointConfigFileName(inputPathOrName);
    const directPath = resolveChannelPointConfigFilePath(normalized);

    if (fs.existsSync(directPath)) return directPath;

    if (!path.extname(normalized)) {
        const yamlPath = resolveChannelPointConfigFilePath(`${normalized}.yaml`);
        if (fs.existsSync(yamlPath)) return yamlPath;

        const ymlPath = resolveChannelPointConfigFilePath(`${normalized}.yml`);
        if (fs.existsSync(ymlPath)) return ymlPath;

        const jsonPath = resolveChannelPointConfigFilePath(`${normalized}.json`);
        if (fs.existsSync(jsonPath)) return jsonPath;

        const namedFilePath = findChannelPointConfigFileByName(normalized);
        if (namedFilePath) return namedFilePath;
    }

    throw new Error("channel point config file not found");
}

function resolveEditableChannelPointConfigFile(inputPathOrName: string = "") {
    if (!inputPathOrName) {
        throw new Error("channel point config path or name is required");
    }

    try {
        return resolveExistingChannelPointConfigFile(inputPathOrName);
    } catch (error) {
        const normalized = normalizeChannelPointConfigFileName(inputPathOrName);

        if (!path.extname(normalized)) {
            return resolveChannelPointConfigFilePath(`${sanitizeChannelPointConfigFileName(normalized)}.yaml`);
        }

        return resolveChannelPointConfigFilePath(normalized);
    }
}

function getChannelPointImage(channelPoint: any) {
    try {
        return channelPoint?.getImageUrl?.(4) ?? channelPoint?.image ?? "";
    } catch (error) {
        return channelPoint?.image ?? "";
    }
}

function createChannelPointPayload(configuredChannelPoint: any = {}, twitchChannelPoint: any = undefined, active = false) {
    const twitchTitle = twitchChannelPoint?.title;
    const label = configuredChannelPoint?.label ?? configuredChannelPoint?.name ?? twitchTitle ?? "";
    const name = configuredChannelPoint?.name ?? configuredChannelPoint?.label ?? twitchTitle ?? label;

    return {
        ...configuredChannelPoint,
        name,
        label,
        twitch_label: twitchTitle ?? configuredChannelPoint?.twitch_label ?? label,
        twitch_name: twitchTitle ?? configuredChannelPoint?.twitch_name ?? name,
        id: twitchChannelPoint?.id ?? configuredChannelPoint?.id ?? "",
        background: twitchChannelPoint?.backgroundColor ?? configuredChannelPoint?.background ?? "",
        image: getChannelPointImage(twitchChannelPoint) || configuredChannelPoint?.image || "",
        active,
        exists_on_twitch: !!twitchChannelPoint,
        input_required: coerceChannelPointBoolean(configuredChannelPoint?.input_required)
            || twitchChannelPoint?.userInputRequired === true
            || twitchChannelPoint?.isUserInputRequired === true,
        twitch_input_required: twitchChannelPoint?.userInputRequired === true
            || twitchChannelPoint?.isUserInputRequired === true,
        twitch_enabled: twitchChannelPoint?.isEnabled ?? false,
        twitch_paused: twitchChannelPoint?.isPaused ?? false,
    };
}

export function getChannelPointUpdatePayload() {
    return {
        active: activeChannelPoints,
        all: allChannelPoints,
    };
}

export function emitChannelPointConfigUpdate() {
    getWebsocketServer()?.send("notify_channel_point_update", getChannelPointUpdatePayload());
    emitSystemStorageUpdate();
}

export function listChannelPointFiles(): ChannelPointConfigFileEntry[] {
    ensureChannelPointConfigDirectory();

    return fs.readdirSync(getChannelPointConfigDirectory(), {withFileTypes: true})
        .filter(entry => entry.isFile() && isChannelPointConfigFile(entry.name))
        .map(entry => ({
            name: entry.name,
            path: entry.name,
            type: "file" as const,
            extension: path.extname(entry.name).replace(/^\./, ""),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

export function readChannelPointFile(inputPathOrName: string) {
    const filePath = resolveExistingChannelPointConfigFile(inputPathOrName);

    if (!fs.statSync(filePath).isFile()) {
        throw new Error("channel point config file not found");
    }

    if (!isChannelPointConfigFile(filePath)) {
        throw new Error("unsupported channel point config file type");
    }

    return {
        path: relativeChannelPointConfigPath(filePath),
        content: fs.readFileSync(filePath, "utf8"),
    };
}

function stringifyChannelPointConfigContent(filePath: string, config: any) {
    const extension = path.extname(filePath).toLowerCase();

    if (extension === ".json") {
        return `${JSON.stringify(config, null, 2)}\n`;
    }

    return yaml.dump(config, {
        lineWidth: -1,
        noRefs: true,
        sortKeys: false,
    });
}

function normalizeChannelPointConfigContentForWrite(filePath: string, content: string, patch: any = {}) {
    const rawConfig = parseChannelPointConfigContent(filePath, content || "") as any;
    const config = rawConfig && typeof rawConfig === "object" && !Array.isArray(rawConfig)
        ? {...rawConfig}
        : {};

    if (hasOwnValue(patch, "label")) config.label = String(patch.label ?? "").trim();
    if (hasOwnValue(patch, "name")) config.name = String(patch.name ?? "").trim();
    if (hasOwnValue(patch, "asset")) config.asset = String(patch.asset ?? "").trim();
    if (hasOwnValue(patch, "macro")) config.macro = String(patch.macro ?? "").trim();
    if (hasOwnValue(patch, "cost")) config.cost = Number(patch.cost || 0);

    if (hasOwnValue(patch, "enable_default")) config.enable_default = coerceChannelPointBoolean(patch.enable_default);
    if (hasOwnValue(patch, "auto_accept")) config.auto_accept = coerceChannelPointBoolean(patch.auto_accept);
    if (hasOwnValue(patch, "strip_emotes")) config.strip_emotes = coerceChannelPointBoolean(patch.strip_emotes);
    if (hasOwnValue(patch, "input_required")) config.input_required = coerceChannelPointBoolean(patch.input_required);
    if (hasOwnValue(patch, "inputRequired")) config.input_required = coerceChannelPointBoolean(patch.inputRequired);

    if (hasOwnValue(config, "inputRequired")) {
        config.input_required = coerceChannelPointBoolean(config.input_required ?? config.inputRequired);
        delete config.inputRequired;
    }

    config.enable_default = coerceChannelPointBoolean(config.enable_default);
    config.auto_accept = coerceChannelPointBoolean(config.auto_accept);
    config.strip_emotes = coerceChannelPointBoolean(config.strip_emotes);
    config.input_required = coerceChannelPointBoolean(config.input_required);

    return stringifyChannelPointConfigContent(filePath, config);
}

export function editChannelPointFile(inputPathOrName: string, content: string, patch: any = {}) {
    const filePath = resolveEditableChannelPointConfigFile(inputPathOrName);

    if (!isChannelPointConfigFile(filePath)) {
        throw new Error("channel point config file must be .yaml, .yml or .json");
    }

    fs.writeFileSync(filePath, normalizeChannelPointConfigContentForWrite(filePath, content ?? "", patch), "utf8");

    loadChannelPointConfigs();
    emitChannelPointConfigUpdate();

    return {
        path: relativeChannelPointConfigPath(filePath),
    };
}

export async function deleteChannelPointFile(inputPathOrName: string) {
    let filePath = "";

    try {
        filePath = resolveExistingChannelPointConfigFile(inputPathOrName);
    } catch (error) {
        logWarn(`channel point config file not found: ${inputPathOrName}`);
    }

    let config: any = {};

    try {
        config = readChannelPointConfigFile(filePath);
    } catch (error) {
        logWarn(`failed to read channel point config before delete ${filePath}`);
    }

    const label = config?.label ?? config?.name ?? inputPathOrName.replace(".yaml", "");
    const twitchChannelPoint = findTwitchChannelPointForConfig({
        label,
        name: label,
    })

    if (twitchChannelPoint) {
        try {
            logRegular(`delete twitch channel point ${twitchChannelPoint.title}`);

            const bot = getTwitchClient().getBot();
            const primaryChannel = getPrimaryChannel();

            await bot.api.channelPoints.deleteCustomReward(primaryChannel, twitchChannelPoint.id);
        } catch (error) {
            logWarn(`delete twitch channel point ${twitchChannelPoint.title} failed:`);
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        }
    }

    try {
        fs.unlinkSync(filePath);
    } catch (error) {
        logWarn(`failed to delete channel point config file ${filePath}`);
    }

    loadChannelPointConfigs();
    await updateChannelPoints();

    return {
        path: relativeChannelPointConfigPath(filePath),
        deleted: true,
        deleted_from_twitch: !!twitchChannelPoint,
    };
}

export function moveChannelPointFile(source: string, target: string) {
    if (!source) throw new Error("source missing");
    if (!target) throw new Error("target missing");

    const sourcePath = resolveExistingChannelPointConfigFile(source);
    const targetName = normalizeChannelPointConfigFileName(target);

    if (!targetName) throw new Error("target missing");

    const targetPath = path.extname(targetName)
        ? resolveChannelPointConfigFilePath(targetName)
        : resolveChannelPointConfigFilePath(`${sanitizeChannelPointConfigFileName(targetName)}.yaml`);

    if (fs.existsSync(targetPath)) {
        throw new Error("target already exists");
    }

    fs.renameSync(sourcePath, targetPath);

    loadChannelPointConfigs();
    emitChannelPointConfigUpdate();

    return {
        source: relativeChannelPointConfigPath(sourcePath),
        target: relativeChannelPointConfigPath(targetPath),
    };
}

export async function addChannelPointFilesFromUpload(files: any[]) {
    if (!files?.length) {
        throw new Error("no files uploaded");
    }

    ensureChannelPointConfigDirectory();

    const added: string[] = [];

    for (const file of files) {
        const originalName = path.basename(file.originalname || file.name || "channel_point.yaml");
        const extension = path.extname(originalName).toLowerCase();

        if (!CHANNEL_POINT_CONFIG_FILE_EXTENSIONS.includes(extension)) continue;

        const target = resolveChannelPointConfigFilePath(originalName);
        const content = file.buffer ?? file.content ?? "";

        fs.writeFileSync(target, content);
        added.push(relativeChannelPointConfigPath(target));
    }

    loadChannelPointConfigs();
    emitChannelPointConfigUpdate();

    return added;
}

export async function fetchChannelPointData() {
    const bot = getTwitchClient().getBot();
    const primaryChannel = getPrimaryChannel();

    const channelPointsData = await bot.api.channelPoints.getCustomRewards(primaryChannel.id);

    channelPoints = {};

    for (const channelPoint of channelPointsData) {
        channelPoints[channelPoint.title] = channelPoint;
    }

    logChannelPointDiffSummary("detected twitch channel points", Object.values(channelPoints));
}

function findTwitchChannelPointForConfig(config: any): HelixCustomReward | undefined {
    return channelPoints[config?.label]
        ?? channelPoints[config?.name]
        ?? Object.values(channelPoints).find(point =>
            normalizeChannelPointLookup(point?.title) === normalizeChannelPointLookup(config?.label)
            || normalizeChannelPointLookup(point?.title) === normalizeChannelPointLookup(config?.name),
        );
}

function pushUniqueChannelPoint(target: any[], usedKeys: Set<string>, payload: any) {
    const key = payload?.id
        ? `id:${payload.id}`
        : `name:${normalizeChannelPointKey(payload?.label ?? payload?.name)}`;

    if (usedKeys.has(key)) return false;

    usedKeys.add(key);
    target.push(payload);

    return true;
}

function getTwitchChannelPointInputRequired(channelPoint: any) {
    return channelPoint?.userInputRequired === true || channelPoint?.isUserInputRequired === true;
}

async function syncChannelPointTwitchSettings(configuredChannelPoint: any, twitchChannelPoint: HelixCustomReward | undefined, primaryChannel: HelixUser) {
    if (!twitchChannelPoint) return;

    const desiredInputRequired = coerceChannelPointBoolean(configuredChannelPoint?.input_required);
    const currentInputRequired = getTwitchChannelPointInputRequired(twitchChannelPoint);

    if (currentInputRequired === desiredInputRequired) return;

    const bot = getTwitchClient().getBot();

    try {
        logRegular(`update channel point input required ${twitchChannelPoint.title}: ${desiredInputRequired}`);

        await bot.api.channelPoints.updateCustomReward(primaryChannel, twitchChannelPoint.id, {
            userInputRequired: desiredInputRequired,
        });

        (twitchChannelPoint as any).userInputRequired = desiredInputRequired;
        (twitchChannelPoint as any).isUserInputRequired = desiredInputRequired;
    } catch (error) {
        logWarn(`update channel point input required ${twitchChannelPoint.title} failed:`);
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
}

export async function updateChannelPoints() {
    await fetchChannelPointData();

    const gameData = await getGameInfoData();
    const primaryChannel = getPrimaryChannel();

    gameMacros = {};

    const localChannelPoints = getConfiguredChannelPoints();

    logChannelPointConfigSummary("detected local channel point configs", localChannelPoints);

    const gameChannelPoints = Array.isArray(gameData?.channel_points)
        ? gameData.channel_points
        : [];

    logChannelPointConfigSummary("detected game channel point configs", gameChannelPoints);

    const blockedChannelPoints = Array.isArray(gameData?.blocked_channel_points)
        ? gameData.blocked_channel_points
        : [];

    const blockedSet = new Set(
        blockedChannelPoints
            .map(normalizeChannelPointLookup)
            .filter(Boolean),
    );

    const validGameChannelPoints = gameChannelPoints
        .filter((point: any) => typeof point?.name === "string" && point.name.trim().length > 0)
        .filter((point: any) => typeof point?.asset === "string" && point.asset.trim().length > 0)
        .filter((point: any) => typeof point?.macro === "string" && point.macro.trim().length > 0)
        .map((point: any) => normalizeChannelPointConfig(point.name, {...point, source: "game"}));

    const skippedGameChannelPoints = gameChannelPoints.length - validGameChannelPoints.length;

    if (skippedGameChannelPoints > 0) {
        logWarn(`skipped invalid game channel point configs: ${skippedGameChannelPoints}`);
    }

    const configuredPoints = [
        ...localChannelPoints,
        ...validGameChannelPoints,
    ];

    logChannelPointConfigSummary("detected merged channel point configs", configuredPoints);

    const desiredEnabledNames = configuredPoints
        .filter((point: any) => point?.enable_default === true || gameChannelPoints.includes(point))
        .map((point: any) => point?.label ?? point?.name)
        .filter((name: any): name is string => typeof name === "string" && name.trim().length > 0)
        .filter(name => !blockedSet.has(normalizeChannelPointLookup(name)));

    const desiredEnabledSet = new Set(desiredEnabledNames.map(normalizeChannelPointLookup));

    logRegular(`blocked channel points: ${blockedSet.size}${blockedSet.size ? ` (${Array.from(blockedSet).join(", ")})` : ""}`);
    logRegular(`desired enabled channel points: ${desiredEnabledNames.length}${desiredEnabledNames.length ? ` (${desiredEnabledNames.join(", ")})` : ""}`);

    for (const channelPoint of configuredPoints) {
        const label = channelPoint?.label ?? channelPoint?.name;

        if (!label || blockedSet.has(normalizeChannelPointLookup(label))) continue;

        if (typeof channelPoint.macro === "string" && channelPoint.macro.trim().length > 0) {
            gameMacros[label] = channelPoint.macro.trim();
        }
    }

    const toDisable = Object.values(channelPoints).filter(point =>
        !desiredEnabledSet.has(normalizeChannelPointLookup(point.title)),
    );

    const toEnable = Object.values(channelPoints).filter(point =>
        desiredEnabledSet.has(normalizeChannelPointLookup(point.title)),
    );

    logChannelPointDiffSummary("twitch channel points to enable", toEnable);
    logChannelPointDiffSummary("twitch channel points to disable", toDisable);

    for (const channelPoint of toDisable) {
        await enableChannelPoint(channelPoint, primaryChannel, false);
    }

    for (const channelPoint of toEnable) {
        await enableChannelPoint(channelPoint, primaryChannel, true);
    }

    activeChannelPoints = [];
    allChannelPoints = [];

    const activeKeys = new Set<string>();
    const allKeys = new Set<string>();

    for (const configuredChannelPoint of configuredPoints) {
        const label = configuredChannelPoint?.label ?? configuredChannelPoint?.name;

        if (!label) continue;

        if (blockedSet.has(normalizeChannelPointLookup(label))) {
            logRegular(`skipping blocked configured channel point: ${label}`);
            continue;
        }

        const twitchChannelPoint = findTwitchChannelPointForConfig(configuredChannelPoint);

        logRegular(`match configured channel point ${label}: ${twitchChannelPoint ? `twitch=${twitchChannelPoint.title} (${twitchChannelPoint.id})` : "missing on twitch"}`);

        await syncChannelPointTwitchSettings(configuredChannelPoint, twitchChannelPoint, primaryChannel);

        const payload = createChannelPointPayload(
            configuredChannelPoint,
            twitchChannelPoint,
            twitchChannelPoint ? desiredEnabledSet.has(normalizeChannelPointLookup(twitchChannelPoint.title)) : false,
        );

        pushUniqueChannelPoint(allChannelPoints, allKeys, payload);

        if (twitchChannelPoint && desiredEnabledSet.has(normalizeChannelPointLookup(twitchChannelPoint.title))) {
            pushUniqueChannelPoint(activeChannelPoints, activeKeys, payload);
        }
    }

    for (const twitchChannelPoint of Object.values(channelPoints)) {
        if (blockedSet.has(normalizeChannelPointLookup(twitchChannelPoint.title))) {
            logRegular(`skipping blocked twitch channel point: ${twitchChannelPoint.title}`);
            continue;
        }

        const payload = createChannelPointPayload(
            {},
            twitchChannelPoint,
            desiredEnabledSet.has(normalizeChannelPointLookup(twitchChannelPoint.title)),
        );

        pushUniqueChannelPoint(allChannelPoints, allKeys, payload);

        if (desiredEnabledSet.has(normalizeChannelPointLookup(twitchChannelPoint.title))) {
            pushUniqueChannelPoint(activeChannelPoints, activeKeys, payload);
        }
    }

    logRegular(`channel point update complete: active=${activeChannelPoints.length}, all=${allChannelPoints.length}, macros=${Object.keys(gameMacros).length}`);

    emitChannelPointConfigUpdate();
}

async function enableChannelPoint(channelPoint: HelixCustomReward, primaryChannel: HelixUser, enable: boolean) {
    if (channelPoint.isEnabled === enable) return;

    const enableMessage = enable ? "enable" : "disable";

    logRegular(`${enableMessage} channel point ${channelPoint.title}`);

    const bot = getTwitchClient().getBot();

    try {
        await bot.api.channelPoints.updateCustomReward(primaryChannel, channelPoint.id, {
            isPaused: false,
            isEnabled: enable,
        });
    } catch (error) {
        logWarn(`${enableMessage} channel point ${channelPoint.title} failed:`);
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
}

export function updateActiveChannelPoint(id: string, isActive: boolean) {
    const index = activeChannelPoints.findIndex(reward => reward.id === id);
    const reward = activeChannelPoints[index];

    if (!reward) return;

    reward.active = isActive;
    activeChannelPoints[index] = reward;

    allChannelPoints.forEach(channelPoint => {
        if (channelPoint.id !== id) return;

        channelPoint.active = isActive;
    });

    emitChannelPointConfigUpdate();
}

export async function toggleChannelPointPause(channelPoint: any, pause = false) {
    const channelPointEntity = channelPoints[channelPoint.name] ?? channelPoints[channelPoint.label];

    if (!channelPointEntity) {
        return false;
    }

    const bot = getTwitchClient().getBot();
    const primaryChannel = getPrimaryChannel();

    await bot?.api?.channelPoints?.updateCustomReward(primaryChannel, channelPointEntity.id, {
        isPaused: pause,
    });

    activeChannelPoints.forEach(activeChannelPoint => {
        if (activeChannelPoint.id !== channelPointEntity.id) return;

        activeChannelPoint.active = !pause;
    });

    allChannelPoints.forEach(allChannelPoint => {
        if (allChannelPoint.id !== channelPointEntity.id) return;

        allChannelPoint.active = !pause;
    });

    emitChannelPointConfigUpdate();

    return true;
}

export async function toggleChannelPoint(channelPoint: any, enable = false) {
    const channelPointEntity = channelPoints[channelPoint.name] ?? channelPoints[channelPoint.label];

    if (!channelPointEntity) {
        return false;
    }

    const bot = getTwitchClient().getBot();
    const primaryChannel = getPrimaryChannel();

    await bot?.api?.channelPoints?.updateCustomReward(primaryChannel, channelPointEntity.id, {
        isPaused: false,
        isEnabled: enable,
    });

    activeChannelPoints.forEach(activeChannelPoint => {
        if (activeChannelPoint.id !== channelPointEntity.id) return;

        activeChannelPoint.active = enable;
    });

    allChannelPoints.forEach(allChannelPoint => {
        if (allChannelPoint.id !== channelPointEntity.id) return;

        allChannelPoint.active = enable;
    });

    emitChannelPointConfigUpdate();

    return true;
}

export function getChannelPointMapping() {
    return channelPoints;
}

export function getActiveChannelPoints() {
    return activeChannelPoints;
}

export function getAllChannelPoints() {
    return allChannelPoints;
}

export function getGameMacro(rewardName: string) {
    return gameMacros[rewardName];
}