import {getPrimaryChannel, getSystemConfigDirectory} from "../../helper/ConfigHelper";
import {Bot, BotCommandContext, createBotCommand} from "@twurple/easy-bot";
import fs from "fs";
import path from "path";
import * as yaml from "js-yaml";
import InfoCommand from "./commands/InfoCommand";
import {logRegular, logWarn} from "../../helper/LogHelper";
import SetGameCommand from "./commands/SetGameCommand";
import ShoutoutCommand from "./commands/ShoutoutCommand";
import ClipCommand from "./commands/ClipCommand";
import GetGameCommand from "./commands/GetGameCommand";
import ToggleErrorMessageCommand from "./commands/ToggleErrorMessageCommand";
import {triggerMacro} from "../../helper/MacroHelper";
import MacroCommand from "./commands/MacroCommand";
import ListScenesCommand from "./commands/ListScenesCommand";
import SetSceneCommand from "./commands/SetSceneCommand";
import MusicCommand from "./commands/MusicCommand";
import ListRotatingScenes from "./commands/ListRotatingScenes";
import StartRotatingSceneCommand from "./commands/StartRotatingSceneCommand";
import {ListMacrosCommand} from "./commands/ListMacrosCommand";
import GiveawayEnterCommand from "./commands/GiveawayEnterCommand";
import {hasModerator, hasVip} from "./helper/PermissionHelper";
import {isShowErrorMessage} from "../../helper/CommandHelper";
import isShieldActive from "../../helper/ShieldHelper";
import {v4 as uuidv4} from "uuid";
import {linkMessageToEvent} from "../../helper/MessageEventLinkHelper";
import TwitchClient from "./Client";

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

export default function buildCommands(bot: Bot, twitchClient?: TwitchClient) {
    let commands: any[] = [];

    commands = commands.concat(new InfoCommand(bot, twitchClient).register());
    commands = commands.concat(new SetGameCommand(bot, twitchClient).register());
    commands = commands.concat(new ShoutoutCommand(bot, twitchClient).register());
    commands = commands.concat(new ClipCommand(bot, twitchClient).register());
    commands = commands.concat(new GetGameCommand(bot, twitchClient).register());
    commands = commands.concat(new ToggleErrorMessageCommand(bot, twitchClient).register());
    commands = commands.concat(new MacroCommand(bot, twitchClient).register());
    commands = commands.concat(new ListScenesCommand(bot, twitchClient).register());
    commands = commands.concat(new SetSceneCommand(bot, twitchClient).register());
    commands = commands.concat(new MusicCommand(bot, twitchClient).register());
    commands = commands.concat(new ListRotatingScenes(bot, twitchClient).register());
    commands = commands.concat(new StartRotatingSceneCommand(bot, twitchClient).register());
    commands = commands.concat(new ListMacrosCommand(bot, twitchClient).register());
    commands = commands.concat(new GiveawayEnterCommand(bot, twitchClient).register());

    commands = buildConfigCommands(commands, bot);

    commands.push(buildOverviewCommand(commands));

    return commands.filter((c) => c != null);
}

function buildOverviewCommand(commands: any[]) {
    let commandList = "";

    for (const command of commands) {
        if (!command || !command.name) continue;
        commandList = `${commandList}, ${command.name}`;
    }

    commandList = commandList.substring(1);

    return createBotCommand("commands", (params, { reply }) => {
        void reply(`Es gibt folgende Befehle: ${commandList}`);
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
            .replace(/[^a-zA-Z0-9_.-]+/g, "_")
            .replace(/^\.+/, "")
        || "command";
}

function getCommandNameFromConfig(filePath: string, commandConfig: any) {
    return normalizeString(commandConfig?.name) ?? getCommandNameFromFile(filePath);
}

function loadCommandsFromFiles() {
    ensureCommandDirectory();

    fileCommands = {};

    for (const filePath of walkCommandFiles(getCommandDirectory())) {
        try {
            const commandConfig = readCommandConfigFile(filePath) as any;
            const commandName = getCommandNameFromConfig(filePath, commandConfig);

            if (!commandName) continue;

            fileCommands[commandName] = {
                ...commandConfig,
                file: path.relative(getCommandDirectory(), filePath).replace(/\\/g, "/"),
            };
        } catch (error) {
            logWarn(`failed to load command file ${filePath}`);
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        }
    }
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
    const { message, ...cleanCommandConfig } = commandConfig ?? {};

    return {
        ...cleanCommandConfig,
        name: commandName,
        macro: `command_${commandName}`,
    };
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

export function getConfiguredCommands() {
    loadCommandsFromFiles();
    return fileCommands;
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

export function editCommandFile(inputPathOrName: string, content: string) {
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

    return {
        path: relativeCommandPath(filePath),
    };
}

export function deleteCommandFile(inputPathOrName: string) {
    const filePath = resolveExistingCommandFile(inputPathOrName);

    if (fs.statSync(filePath).isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
    } else {
        fs.unlinkSync(filePath);
    }

    loadCommandsFromFiles();

    return {
        path: relativeCommandPath(filePath),
    };
}

export function moveCommandFile(source: string, target: string) {
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

    return {
        source: normalizeCommandPath(source).replace(/\\/g, "/"),
        target: normalizeCommandPath(target).replace(/\\/g, "/"),
    };
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

    return added;
}

function buildConfigCommands(commands: any[], bot: Bot) {
    loadCommandsFromFiles();

    for (const command in fileCommands) {
        logRegular(`register command file: ${command}`);
        commands.push(buildConfigCommand(command, fileCommands[command], bot));
    }

    return commands;
}

function buildConfigCommand(command: string, option: any, bot: Bot) {
    const aliases = normalizeArray(option.alias ?? option.aliases ?? []);
    const paramConfig = normalizeArray(option.params ?? []) as ConfigParam[];
    const macro = normalizeString(option.macro);

    const commandOptions: any = {
        aliases,
        userCooldown: option.userCooldown,
        globalCooldown: option.globalCooldown,
    };

    return createBotCommand(command, async (rawParam: string[], context: BotCommandContext) => {
        try {
            logRegular(`command by ${context.userName} in ${context.broadcasterName}: ${command} ${rawParam.join(" ")}`);

            if (option.enforceSame || option.enforce_primary) {
                const primaryChannel = getPrimaryChannel();

                if (context.broadcasterId !== primaryChannel.id) {
                    return;
                }
            }

            if (option.requiresBroadcaster && context.broadcasterId !== context.userId) {
                await replyPermissionError(context);
                return;
            }

            if (
                option.requiresMod &&
                !hasModerator(context.broadcasterName, context.userId) &&
                context.broadcasterId !== context.userId
            ) {
                await replyPermissionError(context);
                return;
            }

            if (
                option.requiresVip &&
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
                await context.reply("der Schild Modus ist aktiv!");
                return;
            }

            const parsedParams = await parseConfigParams(command, rawParam, context, bot, paramConfig);
            if (!parsedParams.ok) return;

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

            if (macro) {
                void triggerMacro(macro, data);
            }
        } catch (error) {
            logWarn(`command ${command} failed:`);
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        }
    }, commandOptions);
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
    validSubcommands: string[],
) {
    logWarn(`invalid param at ${index} by ${context.userName} in ${context.broadcasterName}: ${command} ${param.join(" ")}`);
    await context.reply(`der Parameter ${index + 1} ist ungültig, valide Unterbefehle sind: ${validSubcommands.join(", ")}`);
}

async function replyMissingParamError(
    command: string,
    param: string[],
    context: BotCommandContext,
    index: number,
) {
    logWarn(`missing param at ${index} by ${context.userName} in ${context.broadcasterName}: ${command} ${param.join(" ")}`);
    await context.reply(`der Parameter ${index + 1} wird benötigt!`);
}

async function replyParamSyntaxError(
    command: string,
    param: string[],
    context: BotCommandContext,
    index: number,
    type: string,
) {
    logWarn(`invalid param at ${index} by ${context.userName} in ${context.broadcasterName}: ${command} ${param.join(" ")}`);
    await context.reply(`der Parameter ${index + 1} ist ein ${type}!`);
}

async function replyPermissionError(context: BotCommandContext) {
    logWarn(`permission denied: ${context.userName} in ${context.broadcasterName}`);
    if (!isShowErrorMessage()) return;
    await context.reply("du hast keine Berechtigung auf diesen Befehl!");
}
