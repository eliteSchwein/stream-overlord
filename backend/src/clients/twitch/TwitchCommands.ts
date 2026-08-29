import {getPrimaryChannel, getSystemConfigDirectory} from "../../helper/ConfigHelper";
import {Bot, BotCommandContext, createBotCommand} from "@twurple/easy-bot";
import fs from "fs";
import path from "path";
import * as yaml from "js-yaml";
import InfoCommand from "./commands/InfoCommand";
import {logRegular, logWarn} from "../../helper/LogHelper";
import SetGameCommand from "./commands/SetGameCommand";
import GetGameCommand from "./commands/GetGameCommand";
import ToggleErrorMessageCommand from "./commands/ToggleErrorMessageCommand";
import {triggerMacro} from "../../helper/MacroHelper";
import MusicCommand from "./commands/MusicCommand";
import GiveawayEnterCommand from "./commands/GiveawayEnterCommand";
import {hasModerator, hasVip} from "./helper/PermissionHelper";
import {
    getCommandRuntimeEnabled,
    isShowErrorMessage,
    resetCommandRuntimeStates,
    setCommandRuntimeEnabled,
    toggleCommandRuntimeEnabled,
} from "../../helper/CommandHelper";
import isShieldActive from "../../helper/ShieldHelper";
import {v4 as uuidv4} from "uuid";
import {linkMessageToEvent} from "../../helper/MessageEventLinkHelper";
import TwitchClient from "./Client";
import getWebsocketServer, {getTwitchClient, setReloadUpdate} from "../../App";
import {getAssetConfig} from "../../helper/AssetHelper";
import {addAlert} from "../../helper/AlertHelper";

type ConfigParam = {
    name: string;
    type: "number" | "string" | "subcommand" | "user" | "all";
    required?: boolean;
    subcommands?: { name: string }[];
};

type CommandConfigFileEntry = {
    name: string;
    path: string;
    type: "file" | "directory";
    extension?: string;
};

const COMMAND_FILE_EXTENSIONS = [".yaml", ".yml", ".json"];

let fileCommands: Record<string, any> = {};
let commandRuntimeOverrides: Record<string, any> = {};

const COMMAND_RUNTIME_SETTINGS = new Set([
    "userCooldown",
    "globalCooldown",
    "single_use",
    "user_list_mode",
    "users",
    "requiresBroadcaster",
    "requiresMod",
    "requiresVip",
]);

const COMMAND_REGISTRATION_SETTINGS = new Set([
    "aliases",
    "userCooldown",
    "globalCooldown",
]);

function notifyCommandsUpdate() {
    try {
        getWebsocketServer()?.send("notify_commands_update", {
            commands: getConfiguredCommands(),
        });
    } catch (error) {
        logWarn("failed to notify command update");
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
}

async function reloadTwitchCommandsAfterChange(context: string) {
    const twitchClient = getTwitchClient();

    if (!twitchClient) {
        return;
    }

    try {
        await twitchClient.reloadCommands();
    } catch (error) {
        logWarn(`failed to reload Twitch commands after ${context}`);
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        throw error;
    }
}


export default function buildCommands(bot: Bot, twitchClient?: TwitchClient) {
    let commands: any[] = [];

    commands = commands.concat(new InfoCommand(bot, twitchClient).register());
    commands = commands.concat(new SetGameCommand(bot, twitchClient).register());
    commands = commands.concat(new GetGameCommand(bot, twitchClient).register());
    commands = commands.concat(new ToggleErrorMessageCommand(bot, twitchClient).register());
    commands = commands.concat(new MusicCommand(bot, twitchClient).register());
    commands = commands.concat(new GiveawayEnterCommand(bot, twitchClient).register());

    commands = buildConfigCommands(commands, bot, twitchClient);

    commands.push(buildOverviewCommand(commands, twitchClient));

    return commands.filter((c) => c != null);
}

function buildOverviewCommand(commands: any[], twitchClient?: TwitchClient) {
    return createBotCommand("commands", (params, context) => {
        const commandList = commands
            .filter((entry) => {
                if (!entry?.name) return false;

                const configuredCommand = fileCommands[entry.name];

                if (!configuredCommand) {
                    return true;
                }

                return getCommandRuntimeEnabled(
                    entry.name,
                    configuredCommand.enabled !== false,
                );
            })
            .map((entry) => entry.name)
            .join(", ");

        void twitchClient?.reply(
            `Es gibt folgende Befehle: ${commandList}`,
            context.msg.id,
            context.broadcasterId
        );
    });
}

export function getCommandDirectory() {
    return path.join(getSystemConfigDirectory(), "commands");
}

function ensureCommandDirectory() {
    fs.mkdirSync(getCommandDirectory(), { recursive: true });
}

function normalizeCommandPath(inputPath: string = "") {
    const normalized = path.normalize(String(inputPath || "")).replace(/^([/\\])+/, "");

    if (normalized === ".") return "";

    if (normalized.split(path.sep).includes("..")) {
        throw new Error("invalid command path");
    }

    return normalized;
}

function resolveCommandPath(inputPath: string = "") {
    ensureCommandDirectory();

    const commandDirectory = getCommandDirectory();
    const resolvedPath = path.resolve(commandDirectory, normalizeCommandPath(inputPath));

    if (resolvedPath !== commandDirectory && !resolvedPath.startsWith(`${commandDirectory}${path.sep}`)) {
        throw new Error("invalid command path");
    }

    return resolvedPath;
}

function isCommandFile(filePath: string) {
    return COMMAND_FILE_EXTENSIONS.includes(path.extname(filePath).toLowerCase());
}

function getCommandNameFromFile(filePath: string) {
    return path.basename(filePath, path.extname(filePath));
}

function parseCommandConfigContent(filePath: string, content: string) {
    const extension = path.extname(filePath).toLowerCase();

    if (extension === ".json") {
        return JSON.parse(content);
    }

    return yaml.load(content) ?? {};
}

function readCommandConfigFile(filePath: string) {
    return parseCommandConfigContent(filePath, fs.readFileSync(filePath, "utf8"));
}

function walkCommandFiles(directory: string): string[] {
    if (!fs.existsSync(directory)) return [];

    const result: string[] = [];

    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const entryPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            result.push(...walkCommandFiles(entryPath));
            continue;
        }

        if (entry.isFile() && isCommandFile(entryPath)) {
            result.push(entryPath);
        }
    }

    return result;
}

function sanitizeCommandFileName(name: string) {
    return String(name)
            .trim()
            .replace(/[\\/]+/g, "_")
            .replace(/[^\p{L}\p{N}_.-]+/gu, "_")
            .replace(/^\.+/, "")
        || "command";
}

function getCommandNameFromConfig(filePath: string, commandConfig: any) {
    return normalizeString(commandConfig?.name) ?? getCommandNameFromFile(filePath);
}

function loadCommandsFromFiles() {
    ensureCommandDirectory();

    fileCommands = {};

    const commandDirectory = getCommandDirectory();
    const commandFiles = walkCommandFiles(commandDirectory);

    logRegular(`detected command config directory: ${commandDirectory}`);
    logRegular(`detected command config files: ${commandFiles.length}`);

    for (const filePath of commandFiles) {
        try {
            const commandConfig = readCommandConfigFile(filePath) as any;
            const commandName = getCommandNameFromConfig(filePath, commandConfig);

            if (!commandName) {
                logWarn(`skip command config without name: ${filePath}`);
                continue;
            }

            const relativeFile = path.relative(commandDirectory, filePath).replace(/\\/g, "/");

            fileCommands[commandName] = {
                ...commandConfig,
                file: relativeFile,
            };

            logRegular(
                `loaded command config: ${commandName} ` +
                `(file=${relativeFile}, macro=${commandConfig?.macro ?? `command_${commandName}`}, ` +
                `aliases=${normalizeArray(commandConfig?.alias ?? commandConfig?.aliases ?? []).join(",") || "-"}, ` +
                `params=${normalizeArray(commandConfig?.params ?? []).length})`
            );
        } catch (error) {
            logWarn(`failed to load command file ${filePath}`);
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        }
    }

    commandRuntimeOverrides = {};
    resetCommandRuntimeStates(fileCommands);
    logRegular(`loaded command configs total: ${Object.keys(fileCommands).length}`);
}


function relativeCommandPath(filePath: string) {
    return path.relative(getCommandDirectory(), filePath).replace(/\\/g, "/");
}

function resolveExistingCommandFile(inputPathOrName: string = "") {
    if (!inputPathOrName) {
        throw new Error("command path or name is required");
    }

    const normalized = normalizeCommandPath(inputPathOrName);
    const directPath = resolveCommandPath(normalized);

    if (fs.existsSync(directPath)) {
        return directPath;
    }

    if (!path.extname(normalized)) {
        const yamlPath = resolveCommandPath(`${normalized}.yaml`);
        if (fs.existsSync(yamlPath)) return yamlPath;

        const ymlPath = resolveCommandPath(`${normalized}.yml`);
        if (fs.existsSync(ymlPath)) return ymlPath;

        const jsonPath = resolveCommandPath(`${normalized}.json`);
        if (fs.existsSync(jsonPath)) return jsonPath;

        for (const filePath of walkCommandFiles(getCommandDirectory())) {
            try {
                const commandConfig = readCommandConfigFile(filePath) as any;
                const commandName = getCommandNameFromConfig(filePath, commandConfig);

                if (commandName === normalized || getCommandNameFromFile(filePath) === normalized) {
                    return filePath;
                }
            } catch (error) {
                logWarn(`failed to inspect command file ${filePath}`);
                logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
            }
        }
    }

    throw new Error("command file not found");
}

function resolveEditableCommandFile(inputPathOrName: string = "") {
    if (!inputPathOrName) {
        throw new Error("command path or name is required");
    }

    try {
        return resolveExistingCommandFile(inputPathOrName);
    } catch (error) {
        const normalized = normalizeCommandPath(inputPathOrName);

        if (!path.extname(normalized)) {
            return resolveCommandPath(`${sanitizeCommandFileName(normalized)}.yaml`);
        }

        return resolveCommandPath(normalized);
    }
}

function normalizeCommandConfigForSave(filePath: string, commandConfig: any) {
    const commandName = getCommandNameFromConfig(filePath, commandConfig);
    const {message, ...cleanCommandConfig} = commandConfig ?? {};

    const normalizedConfig: any = {
        ...cleanCommandConfig,
        name: commandName,
        enabled: cleanCommandConfig?.enabled !== false,
        single_use: normalizeSingleUse(cleanCommandConfig?.single_use ?? cleanCommandConfig?.singleUse),
        user_list_mode: normalizeUserListMode(cleanCommandConfig?.user_list_mode ?? cleanCommandConfig?.userListMode),
        users: normalizeArray(
            cleanCommandConfig?.users ??
            cleanCommandConfig?.user_list ??
            cleanCommandConfig?.userList ??
            [],
        )
            .map(value => normalizeUserName(value))
            .filter(Boolean),
    };

    delete normalizedConfig.singleUse;
    delete normalizedConfig.userListMode;
    delete normalizedConfig.user_list;
    delete normalizedConfig.userList;

    const macro = normalizeString(cleanCommandConfig?.macro);
    const asset = normalizeString(cleanCommandConfig?.asset);

    if (macro) {
        normalizedConfig.macro = macro;
    } else {
        delete normalizedConfig.macro;
    }

    if (asset) {
        normalizedConfig.asset = asset;
    } else {
        delete normalizedConfig.asset;
    }

    return normalizedConfig;
}

function stringifyCommandConfigContent(filePath: string, commandConfig: any) {
    const extension = path.extname(filePath).toLowerCase();

    if (extension === ".json") {
        return `${JSON.stringify(commandConfig, null, 4)}\n`;
    }

    return yaml.dump(commandConfig, {
        noRefs: true,
        lineWidth: -1,
        sortKeys: false,
    });
}

function getEffectiveCommandConfig(name: string) {
    const command = fileCommands[name];

    if (!command) {
        return undefined;
    }

    return {
        ...command,
        ...(commandRuntimeOverrides[name] ?? {}),
    };
}

function normalizeRuntimeCommandSetting(setting: string, value: any) {
    switch (setting) {
        case "users":
            return normalizeRuntimeArray(value)
                .map(entry => String(entry ?? "").trim())
                .filter(Boolean);

        case "userCooldown":
        case "globalCooldown": {
            if (value === "" || value === null || value === undefined) {
                return undefined;
            }

            const numberValue = Number(value);

            if (!Number.isFinite(numberValue) || numberValue < 0) {
                throw new Error(`${setting} must be a positive number`);
            }

            return numberValue;
        }

        case "single_use":
            return normalizeSingleUse(value);

        case "user_list_mode":
            return normalizeUserListMode(value);

        case "requiresBroadcaster":
        case "requiresMod":
        case "requiresVip":
            return normalizeBoolean(value);

        default:
            throw new Error(`unsupported command runtime setting: ${setting}`);
    }
}

function normalizeRuntimeArray(value: any): any[] {
    if (Array.isArray(value)) {
        return value;
    }

    if (value === undefined || value === null || value === "") {
        return [];
    }

    if (typeof value === "string") {
        const trimmed = value.trim();

        if (!trimmed) {
            return [];
        }

        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
            try {
                const parsed = JSON.parse(trimmed);
                if (Array.isArray(parsed)) return parsed;
            } catch {
                // Fall through to comma/newline parsing.
            }
        }

        return trimmed
            .split(/[,\n]/)
            .map(entry => entry.trim())
            .filter(Boolean);
    }

    return [value];
}

function normalizeBoolean(value: any): boolean {
    if (typeof value === "boolean") {
        return value;
    }

    const normalized = String(value ?? "").trim().toLowerCase();

    if (["true", "1", "yes", "on", "enable", "enabled"].includes(normalized)) {
        return true;
    }

    if (["false", "0", "no", "off", "disable", "disabled"].includes(normalized)) {
        return false;
    }

    return Boolean(value);
}

export async function setConfiguredCommandRuntimeSettings(
    name: string,
    settings: Record<string, any>,
) {
    const commandName = String(name ?? "").trim().replace(/^!+/, "");

    if (!commandName) {
        throw new Error("command name is required");
    }

    if (!fileCommands[commandName]) {
        throw new Error(`command not found: ${commandName}`);
    }

    const entries = Object.entries(settings ?? {});

    if (entries.length === 0) {
        return getConfiguredCommands()[commandName];
    }

    const normalizedSettings: Record<string, any> = {};
    let needsReload = false;

    for (const [setting, value] of entries) {
        if (!COMMAND_RUNTIME_SETTINGS.has(setting)) {
            throw new Error(`unsupported command runtime setting: ${setting}`);
        }

        normalizedSettings[setting] = normalizeRuntimeCommandSetting(setting, value);

        if (COMMAND_REGISTRATION_SETTINGS.has(setting)) {
            needsReload = true;
        }
    }

    commandRuntimeOverrides[commandName] = {
        ...(commandRuntimeOverrides[commandName] ?? {}),
        ...normalizedSettings,
    };

    logRegular(
        `command ${commandName} temporary settings = ${JSON.stringify(normalizedSettings)}`
    );

    notifyCommandsUpdate();

    if (needsReload) {
        await reloadTwitchCommandsAfterChange(
            `changing temporary command settings for ${commandName}`,
        );
    }

    return {
        ...getConfiguredCommands()[commandName],
        runtime_settings: commandRuntimeOverrides[commandName] ?? {},
    };
}

export async function setConfiguredCommandRuntimeSetting(
    name: string,
    setting: string,
    value: any,
) {
    return setConfiguredCommandRuntimeSettings(name, {
        [String(setting ?? "").trim()]: value,
    });
}

export async function resetConfiguredCommandRuntimeSetting(
    name: string,
    setting?: string,
) {
    const commandName = String(name ?? "").trim().replace(/^!+/, "");
    const normalizedSetting = String(setting ?? "").trim();

    if (!commandName) {
        throw new Error("command name is required");
    }

    const commandConfig = fileCommands[commandName];

    if (!commandConfig) {
        throw new Error(`command not found: ${commandName}`);
    }

    if (!normalizedSetting) {
        const previousOverrides = commandRuntimeOverrides[commandName] ?? {};
        const needsReload = Object.keys(previousOverrides)
            .some(key => COMMAND_REGISTRATION_SETTINGS.has(key));

        delete commandRuntimeOverrides[commandName];
        setCommandRuntimeEnabled(commandName, commandConfig.enabled !== false);

        logRegular(`command ${commandName} temporary settings reset`);
        notifyCommandsUpdate();

        if (needsReload) {
            await reloadTwitchCommandsAfterChange(
                `resetting temporary command settings for ${commandName}`,
            );
        }

        return getConfiguredCommands()[commandName];
    }

    if (normalizedSetting === "enabled") {
        setCommandRuntimeEnabled(commandName, commandConfig.enabled !== false);
        logRegular(`command ${commandName} temporary enabled state reset`);
        notifyCommandsUpdate();
        return getConfiguredCommands()[commandName];
    }

    if (!COMMAND_RUNTIME_SETTINGS.has(normalizedSetting)) {
        throw new Error(`unsupported command runtime setting: ${normalizedSetting}`);
    }

    const hadOverride = Object.prototype.hasOwnProperty.call(
        commandRuntimeOverrides[commandName] ?? {},
        normalizedSetting,
    );

    if (commandRuntimeOverrides[commandName]) {
        delete commandRuntimeOverrides[commandName][normalizedSetting];

        if (Object.keys(commandRuntimeOverrides[commandName]).length === 0) {
            delete commandRuntimeOverrides[commandName];
        }
    }

    if (hadOverride) {
        logRegular(`command ${commandName} temporary setting ${normalizedSetting} reset`);
        notifyCommandsUpdate();

        if (COMMAND_REGISTRATION_SETTINGS.has(normalizedSetting)) {
            await reloadTwitchCommandsAfterChange(
                `resetting temporary command setting ${normalizedSetting} for ${commandName}`,
            );
        }
    }

    return getConfiguredCommands()[commandName];
}

export function setConfiguredCommandRuntimeEnabled(
    name: string,
    enabled: boolean,
) {
    const commandName = String(name ?? "").trim().replace(/^!+/, "");

    if (!commandName) {
        throw new Error("command name is required");
    }

    const commandConfig = fileCommands[commandName];

    if (!commandConfig) {
        throw new Error(`command not found: ${commandName}`);
    }

    setCommandRuntimeEnabled(commandName, enabled);
    logRegular(`command ${commandName} temporarily ${enabled ? "enabled" : "disabled"}`);
    notifyCommandsUpdate();

    return getConfiguredCommands()[commandName];
}

export function toggleConfiguredCommandRuntimeEnabled(name: string) {
    const commandName = String(name ?? "").trim().replace(/^!+/, "");

    if (!commandName) {
        throw new Error("command name is required");
    }

    const commandConfig = fileCommands[commandName];

    if (!commandConfig) {
        throw new Error(`command not found: ${commandName}`);
    }

    const enabled = toggleCommandRuntimeEnabled(
        commandName,
        commandConfig.enabled !== false,
    );

    logRegular(`command ${commandName} temporarily ${enabled ? "enabled" : "disabled"}`);
    notifyCommandsUpdate();

    return {
        ...getConfiguredCommands()[commandName],
        runtime_enabled: enabled,
    };
}

export function getConfiguredCommands() {
    return Object.fromEntries(
        Object.entries(fileCommands).map(([name, command]) => [
            name,
            {
                ...command,
                runtime_enabled: getCommandRuntimeEnabled(
                    name,
                    command?.enabled !== false,
                ),
                runtime_settings: {
                    ...(commandRuntimeOverrides[name] ?? {}),
                },
            },
        ]),
    );
}

export function listCommandFiles(inputPath: string = ""): CommandConfigFileEntry[] {
    const directory = resolveCommandPath(inputPath);

    if (!fs.existsSync(directory)) {
        return [];
    }

    if (!fs.statSync(directory).isDirectory()) {
        throw new Error("command path is not a directory");
    }

    return fs.readdirSync(directory, { withFileTypes: true })
        .filter(entry => entry.isDirectory() || (entry.isFile() && isCommandFile(entry.name)))
        .map(entry => ({
            name: entry.name,
            path: path.join(normalizeCommandPath(inputPath), entry.name).replace(/\\/g, "/"),
            type: entry.isDirectory() ? "directory" : "file",
            extension: entry.isFile() ? path.extname(entry.name).replace(/^\./, "") : undefined,
        }))
        .sort((a, b) => {
            if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
}


export function readCommandFile(inputPathOrName: string) {
    const filePath = resolveExistingCommandFile(inputPathOrName);

    if (!fs.statSync(filePath).isFile()) {
        throw new Error("command file not found");
    }

    if (!isCommandFile(filePath)) {
        throw new Error("unsupported command file type");
    }

    return {
        path: relativeCommandPath(filePath),
        content: fs.readFileSync(filePath, "utf8"),
    };
}

export async function editCommandFile(inputPathOrName: string, content: string) {
    setReloadUpdate(false);

    try {
        const filePath = resolveEditableCommandFile(inputPathOrName);

        if (!isCommandFile(filePath)) {
            throw new Error("command file must be .yaml, .yml or .json");
        }

        const previousContent = fs.existsSync(filePath) && fs.statSync(filePath).isFile()
            ? fs.readFileSync(filePath, "utf8")
            : undefined;
        const nextContent = String(content ?? "");

        if (previousContent !== undefined && !nextContent.trim()) {
            throw new Error("refusing to overwrite existing command with empty content");
        }

        const parsedContent = parseCommandConfigContent(filePath, nextContent);
        const normalizedContent = normalizeCommandConfigForSave(filePath, parsedContent);
        const fileContent = stringifyCommandConfigContent(filePath, normalizedContent);

        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, fileContent, "utf8");

        loadCommandsFromFiles();
        notifyCommandsUpdate();

        await reloadTwitchCommandsAfterChange("saving command file");

        return {
            path: relativeCommandPath(filePath),
        };
    } finally {
        setReloadUpdate(true);
    }
}

export async function deleteCommandFile(inputPathOrName: string) {
    setReloadUpdate(false);

    try {
        const filePath = resolveExistingCommandFile(inputPathOrName);
        const relativePath = relativeCommandPath(filePath);

        if (fs.statSync(filePath).isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
        } else {
            fs.unlinkSync(filePath);
        }

        loadCommandsFromFiles();
        notifyCommandsUpdate();

        await reloadTwitchCommandsAfterChange("deleting command file");

        return {
            path: relativePath,
        };
    } finally {
        setReloadUpdate(true);
    }
}

export async function moveCommandFile(source: string, target: string) {
    setReloadUpdate(false);

    try {
        const sourcePath = resolveCommandPath(source);
        const targetPath = resolveCommandPath(target);

        if (!fs.existsSync(sourcePath)) {
            throw new Error("source command path not found");
        }

        if (fs.existsSync(targetPath)) {
            throw new Error("target command path already exists");
        }

        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.renameSync(sourcePath, targetPath);

        loadCommandsFromFiles();
        notifyCommandsUpdate();

        await reloadTwitchCommandsAfterChange("moving command file");

        return {
            source: normalizeCommandPath(source).replace(/\\/g, "/"),
            target: normalizeCommandPath(target).replace(/\\/g, "/"),
        };
    } finally {
        setReloadUpdate(true);
    }
}

type CommandUploadFile = {
    originalname?: string;
    buffer?: Buffer;
};

function sanitizeCommandUploadFileName(name: string) {
    const extension = path.extname(name).toLowerCase();
    const baseName = path.basename(name, extension);

    return `${sanitizeCommandFileName(baseName)}${extension || ".yaml"}`;
}

export async function addCommandFilesFromUpload(files: CommandUploadFile[] = [], targetPath: string = "") {
    setReloadUpdate(false);

    try {
        ensureCommandDirectory();

        const targetDirectory = resolveCommandPath(targetPath);
        fs.mkdirSync(targetDirectory, { recursive: true });

        const added: CommandConfigFileEntry[] = [];

        for (const file of files) {
            if (!file?.buffer) continue;

            const originalName = file.originalname ?? "command.yaml";
            const fileName = sanitizeCommandUploadFileName(originalName);
            const extension = path.extname(fileName).toLowerCase();

            if (!COMMAND_FILE_EXTENSIONS.includes(extension)) {
                throw new Error(`unsupported command file type: ${originalName}`);
            }

            const filePath = path.join(targetDirectory, fileName);
            const resolvedFilePath = path.resolve(filePath);

            if (resolvedFilePath !== getCommandDirectory() && !resolvedFilePath.startsWith(`${getCommandDirectory()}${path.sep}`)) {
                throw new Error("invalid command upload path");
            }

            const parsedContent = parseCommandConfigContent(resolvedFilePath, file.buffer.toString("utf8"));
            const normalizedContent = normalizeCommandConfigForSave(resolvedFilePath, parsedContent);
            const fileContent = stringifyCommandConfigContent(resolvedFilePath, normalizedContent);

            fs.writeFileSync(resolvedFilePath, fileContent, "utf8");

            added.push({
                name: path.basename(resolvedFilePath),
                path: relativeCommandPath(resolvedFilePath),
                type: "file",
                extension: extension.replace(/^\./, ""),
            });
        }

        loadCommandsFromFiles();
        notifyCommandsUpdate();

        await reloadTwitchCommandsAfterChange("uploading command files");

        return added;
    } finally {
        setReloadUpdate(true);
    }
}

function buildConfigCommands(commands: any[], bot: Bot, twitchClient: TwitchClient) {
    if (Object.keys(fileCommands).length === 0) {
        loadCommandsFromFiles();
    }

    const commandNames = Object.keys(fileCommands);

    logRegular(`register configured commands: ${commandNames.length}`);

    for (const command of commandNames) {
        const config = getEffectiveCommandConfig(command) ?? fileCommands[command];

        logRegular(
            `register command file: ${command} ` +
            `(file=${config?.file ?? "-"}, macro=${config?.macro ?? "-"}, ` +
            `aliases=${normalizeArray(config?.alias ?? config?.aliases ?? []).join(",") || "-"})`
        );

        commands.push(buildConfigCommand(command, config, bot, twitchClient));
    }

    return commands;
}

function buildConfigCommand(command: string, option: any, bot: Bot, twitchClient: TwitchClient) {
    const registrationOption = getEffectiveCommandConfig(command) ?? option;
    const aliases = normalizeArray(registrationOption.alias ?? registrationOption.aliases ?? []);

    const commandOptions: any = {
        aliases,
        userCooldown: registrationOption.userCooldown,
        globalCooldown: registrationOption.globalCooldown,
    };

    let globallyUsed = false;
    const usedByUsers = new Set<string>();

    return createBotCommand(command, async (rawParam: string[], context: BotCommandContext) => {
        try {
            const currentOption = getEffectiveCommandConfig(command) ?? option;

            if (!getCommandRuntimeEnabled(command, currentOption.enabled !== false)) {
                return;
            }

            const paramConfig = normalizeArray(currentOption.params ?? []) as ConfigParam[];
            const macro = normalizeString(currentOption.macro);
            const assetName = normalizeString(currentOption.asset);
            const singleUse = normalizeSingleUse(currentOption.single_use ?? currentOption.singleUse);
            const userListMode = normalizeUserListMode(
                currentOption.user_list_mode ?? currentOption.userListMode
            );
            const userList = new Set(
                normalizeArray(currentOption.users ?? currentOption.user_list ?? currentOption.userList ?? [])
                    .map(value => normalizeUserName(value))
                    .filter(Boolean),
            );

            logRegular(`command by ${context.userName} in ${context.broadcasterName}: ${command} ${rawParam.join(" ")}`);

            if (currentOption.enforceSame || currentOption.enforce_primary) {
                const primaryChannel = getPrimaryChannel();

                if (context.broadcasterId !== primaryChannel.id) {
                    return;
                }
            }

            const normalizedUserName = normalizeUserName(context.userName);
            const singleUseUserKey = String(context.userId || normalizedUserName);

            if (
                (userListMode === "blacklist" && userList.has(normalizedUserName)) ||
                (userListMode === "whitelist" && !userList.has(normalizedUserName))
            ) {
                await replyCommandUnavailable(context);
                return;
            }

            if (singleUse === "global" && globallyUsed) {
                await replyCommandAlreadyUsed(context);
                return;
            }

            if (singleUse === "user" && usedByUsers.has(singleUseUserKey)) {
                await replyCommandAlreadyUsed(context);
                return;
            }

            if (currentOption.requiresBroadcaster && context.broadcasterId !== context.userId) {
                await replyPermissionError(context);
                return;
            }

            if (
                currentOption.requiresMod &&
                !hasModerator(context.broadcasterName, context.userId) &&
                context.broadcasterId !== context.userId
            ) {
                await replyPermissionError(context);
                return;
            }

            if (
                currentOption.requiresVip &&
                !hasVip(context.broadcasterName, context.userId) &&
                context.broadcasterId !== context.userId
            ) {
                await replyPermissionError(context);
                return;
            }

            if (
                isShieldActive() &&
                !hasModerator(context.broadcasterName, context.userId) &&
                context.broadcasterId !== context.userId
            ) {
                if (twitchClient && context.msg?.id) {
                    await twitchClient.reply(
                        "der Schild Modus ist aktiv!",
                        context.msg.id,
                        context.broadcasterId
                    );
                } else {
                    await context.reply("der Schild Modus ist aktiv!");
                }

                return;
            }

            const parsedParams = await parseConfigParams(command, rawParam, context, bot, paramConfig);
            if (!parsedParams.ok) return;

            if (singleUse === "global") {
                globallyUsed = true;
            } else if (singleUse === "user") {
                usedByUsers.add(singleUseUserKey);
            }

            const eventUuid = `command_${uuidv4()}`;

            linkMessageToEvent(context.msg?.id, eventUuid);

            const data = {
                eventUuid,
                command,
                params: parsedParams.params,
                data: parsedParams.params,
                context: {
                    messageId: context.msg?.id,
                    userId: context.userId,
                    userName: context.userName,
                    userDisplayName: context.userDisplayName,
                    broadcasterId: context.broadcasterId,
                    broadcasterName: context.broadcasterName,
                },
                ...parsedParams.params,
            };

            logRegular(`command by ${context.userName} in ${context.broadcasterName}: ${command} ${rawParam.join(" ")}`);

            if (assetName) {
                const asset = getAssetConfig(assetName);

                if (!asset) {
                    logWarn(`command ${command} asset was not found: ${assetName}`);
                } else {
                    const alertVariables = {
                        ...data,
                        asset: assetName,
                        eventUuid,
                    };

                    addAlert({
                        asset: assetName,
                        sound: asset.sound,
                        duration: asset.duration ?? 15,
                        color: asset.color,
                        icon: asset.icon,
                        message: asset.message ?? "",
                        "event-uuid": eventUuid,
                        speak: false,
                        video: asset.video,
                        wled: asset.wled,
                        volume: asset.volume,
                        image: asset.image,
                        channel: asset.channel,
                        start_macros: asset.start_macros ?? [],
                        idle_macros: asset.idle_macros ?? [],
                        end_macros: asset.end_macros ?? [],
                        variables: alertVariables,
                    });

                    logRegular(`command ${command} triggered asset: ${assetName}`);
                }
            }

            if (macro) {
                void triggerMacro(macro, data);
            }
        } catch (error) {
            logWarn(`command ${command} failed:`);
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        }
    }, commandOptions);
}

function normalizeSingleUse(value: any): "none" | "user" | "global" {
    const normalized = String(value ?? "none").trim().toLowerCase();

    if (normalized === "user" || normalized === "global") {
        return normalized;
    }

    return "none";
}

function normalizeUserListMode(value: any): "none" | "blacklist" | "whitelist" {
    const normalized = String(value ?? "none").trim().toLowerCase();

    if (normalized === "blacklist" || normalized === "whitelist") {
        return normalized;
    }

    return "none";
}

function normalizeUserName(value: any): string {
    return String(value ?? "")
        .trim()
        .replace(/^@+/, "")
        .toLowerCase();
}

async function parseConfigParams(
    command: string,
    rawParam: string[],
    context: BotCommandContext,
    bot: Bot,
    paramConfig: ConfigParam[],
): Promise<{ ok: true; params: any } | { ok: false }> {
    const params: any = {};

    for (const paramOptions of paramConfig) {
        if (paramOptions.required === undefined) {
            paramOptions.required = true;
        }
    }

    const requiredParams = paramConfig.filter((p) => p.required);

    if (rawParam.length < requiredParams.length) {
        await replyMissingParamError(command, rawParam, context, rawParam.length);
        return { ok: false };
    }

    const firstParamOptions = paramConfig[0];

    if (firstParamOptions?.type === "all") {
        const data = rawParam.join(" ");

        if (firstParamOptions.required !== false && data.trim() === "") {
            await replyParamSyntaxError(command, rawParam, context, 0, "Text");
            return { ok: false };
        }

        params[firstParamOptions.name] = data;
        return { ok: true, params };
    }

    let paramIndex = 0;

    for (const paramPartial of rawParam) {
        const paramOptions = paramConfig[paramIndex];

        if (!paramOptions) continue;

        if (paramOptions.type === "number") {
            const number = Number(paramPartial);

            if (isNaN(number)) {
                await replyParamSyntaxError(command, rawParam, context, paramIndex, "Nummer");
                return { ok: false };
            }

            params[paramOptions.name] = number;
            paramIndex++;
            continue;
        }

        if (paramOptions.type === "user") {
            let userName = paramPartial;
            if (userName.startsWith("@")) userName = userName.substring(1);

            const user = await bot.api.users.getUserByName(userName);

            if (!user) {
                await replyParamSyntaxError(command, rawParam, context, paramIndex, "Benutzer");
                return { ok: false };
            }

            let gameName = "";

            try {
                const stream = await bot.api.streams.getStreamByUserId(user.id);
                gameName = stream?.gameName ?? "";
            } catch (_) {
                logWarn(`failed to fetch category for command user ${user.displayName}`);
            }

            (user as any).gameName = gameName;

            params[paramOptions.name] = user;
            paramIndex++;
            continue;
        }

        if (paramOptions.type === "subcommand") {
            const validSubcommands = (paramOptions.subcommands ?? []).map((s) => s.name);

            if (!validSubcommands.includes(paramPartial)) {
                await replyInvalidSubcommand(command, rawParam, context, paramIndex, validSubcommands);
                return { ok: false };
            }

            params[paramOptions.name] = paramPartial;
            paramIndex++;
            continue;
        }

        params[paramOptions.name] = paramPartial;
        paramIndex++;
    }

    return { ok: true, params };
}

function normalizeString(value: any): string | undefined {
    if (value === undefined || value === null) return undefined;

    if (typeof value !== "string") return String(value);

    const trimmed = value.trim();

    if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
        return trimmed.substring(1, trimmed.length - 1);
    }

    return trimmed;
}

function normalizeArray(value: any): any[] {
    if (Array.isArray(value)) return value;

    if (value === undefined || value === null || value === "") return [];

    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    return [];
}

async function replyInvalidSubcommand(
    command: string,
    param: string[],
    context: BotCommandContext,
    index: number,
    validSubcommands: string[]
) {
    logWarn(`invalid param at ${index} by ${context.userName} in ${context.broadcasterName}: ${command} ${param.join(" ")}`);

    await replyWithFallback(
        context,
        `der Parameter ${index + 1} ist ungültig, valide Unterbefehle sind: ${validSubcommands.join(", ")}`
    );
}

async function replyMissingParamError(
    command: string,
    param: string[],
    context: BotCommandContext,
    index: number,
) {
    logWarn(`missing param at ${index} by ${context.userName} in ${context.broadcasterName}: ${command} ${param.join(" ")}`);

    await replyWithFallback(
        context,
        `der Parameter ${index + 1} wird benötigt!`
    );
}

async function replyParamSyntaxError(
    command: string,
    param: string[],
    context: BotCommandContext,
    index: number,
    type: string,
) {
    logWarn(`invalid param at ${index} by ${context.userName} in ${context.broadcasterName}: ${command} ${param.join(" ")}`);

    await replyWithFallback(
        context,
        `der Parameter ${index + 1} ist ein ${type}!`
    );
}

async function replyPermissionError(
    context: BotCommandContext,
) {
    logWarn(`permission denied: ${context.userName} in ${context.broadcasterName}`);
    if (!isShowErrorMessage()) return;

    await replyWithFallback(
        context,
        "du hast keine Berechtigung auf diesen Befehl!",
    );
}

async function replyCommandUnavailable(
    context: BotCommandContext,
) {
    logWarn(`command unavailable for ${context.userName} in ${context.broadcasterName}`);
    if (!isShowErrorMessage()) return;

    await replyWithFallback(
        context,
        "du kannst diesen Befehl nicht verwenden!",
    );
}

async function replyCommandAlreadyUsed(
    context: BotCommandContext,
) {
    logWarn(`single-use command already used by ${context.userName} in ${context.broadcasterName}`);
    if (!isShowErrorMessage()) return;

    await replyWithFallback(
        context,
        "dieser Befehl wurde bereits verwendet!",
    );
}

async function replyWithFallback(
    context: BotCommandContext,
    message: string,
) {
    const twitchClient = getTwitchClient()
    if (twitchClient && context.msg?.id) {
        await twitchClient.reply(message, context.msg.id, context.broadcasterId);
        return;
    }

    await context.reply(message);
}