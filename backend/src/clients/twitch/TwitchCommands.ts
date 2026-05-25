import { getConfig, getPrimaryChannel } from "../../helper/ConfigHelper";
import { Bot, BotCommandContext, createBotCommand } from "@twurple/easy-bot";
import InfoCommand from "./commands/InfoCommand";
import { logRegular, logWarn } from "../../helper/LogHelper";
import SetGameCommand from "./commands/SetGameCommand";
import ShoutoutCommand from "./commands/ShoutoutCommand";
import ClipCommand from "./commands/ClipCommand";
import GetGameCommand from "./commands/GetGameCommand";
import ToggleErrorMessageCommand from "./commands/ToggleErrorMessageCommand";
import { triggerMacro } from "../../helper/MacroHelper";
import MacroCommand from "./commands/MacroCommand";
import ListScenesCommand from "./commands/ListScenesCommand";
import SetSceneCommand from "./commands/SetSceneCommand";
import MusicCommand from "./commands/MusicCommand";
import ListRotatingScenes from "./commands/ListRotatingScenes";
import StartRotatingSceneCommand from "./commands/StartRotatingSceneCommand";
import { ListMacrosCommand } from "./commands/ListMacrosCommand";
import fillTemplate from "../../helper/TemplateHelper";
import GiveawayEnterCommand from "./commands/GiveawayEnterCommand";
import { hasModerator, hasVip } from "./helper/PermissionHelper";
import { isShowErrorMessage } from "../../helper/CommandHelper";
import isShieldActive from "../../helper/ShieldHelper";
import { v4 as uuidv4 } from "uuid";
import { linkMessageToEvent } from "../../helper/MessageEventLinkHelper";

type ConfigParam = {
    name: string;
    type: "number" | "string" | "subcommand" | "user" | "all";
    required?: boolean;
    subcommands?: { name: string }[];
};

export default function buildCommands(bot: Bot) {
    let commands: any[] = [];

    commands = commands.concat(new InfoCommand(bot).register());
    commands = commands.concat(new SetGameCommand(bot).register());
    commands = commands.concat(new ShoutoutCommand(bot).register());
    commands = commands.concat(new ClipCommand(bot).register());
    commands = commands.concat(new GetGameCommand(bot).register());
    commands = commands.concat(new ToggleErrorMessageCommand(bot).register());
    commands = commands.concat(new MacroCommand(bot).register());
    commands = commands.concat(new ListScenesCommand(bot).register());
    commands = commands.concat(new SetSceneCommand(bot).register());
    commands = commands.concat(new MusicCommand(bot).register());
    commands = commands.concat(new ListRotatingScenes(bot).register());
    commands = commands.concat(new StartRotatingSceneCommand(bot).register());
    commands = commands.concat(new ListMacrosCommand(bot).register());
    commands = commands.concat(new GiveawayEnterCommand(bot).register());

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

function buildConfigCommands(commands: any[], bot: Bot) {
    const config = getConfig(/^command /g, true);

    for (const command in config) {
        const commandContent = config[command];

        logRegular(`register command: ${command}`);

        commands.push(buildConfigCommand(command, commandContent, bot));
    }

    return commands;
}

function buildConfigCommand(command: string, option: any, bot: Bot) {
    const aliases = normalizeArray(option.alias ?? option.aliases ?? []);
    const paramConfig = normalizeArray(option.params ?? []) as ConfigParam[];
    const macro = normalizeString(option.macro);
    const message = normalizeString(option.message);

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

            if (message) {
                void context.reply(fillTemplate(message, data));
            } else {
            }

            if (macro) {
                void triggerMacro(macro, data);
            } else {
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