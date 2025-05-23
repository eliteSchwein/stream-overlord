import {getConfig, getPrimaryChannel} from "../../helper/ConfigHelper";
import {Bot, createBotCommand} from "@twurple/easy-bot";
import InfoCommand from "./commands/InfoCommand";
import {logRegular} from "../../helper/LogHelper";
import SetGameCommand from "./commands/SetGameCommand";
import HardwareCommand from "./commands/HardwareCommand";
import ShoutoutCommand from "./commands/ShoutoutCommand";
import ClipCommand from "./commands/ClipCommand";
import GetGameCommand from "./commands/GetGameCommand";
import ToggleErrorMessageCommand from "./commands/ToggleErrorMessageCommand";
import TTSCommand from "./commands/TTSCommand";
import {getTwitchClient} from "../../App";

export default function buildCommands(bot: Bot) {
    let commands = []

    // coded commands
    commands = commands.concat(new InfoCommand(bot).register())
    commands = commands.concat(new SetGameCommand(bot).register())
    commands = commands.concat(new ShoutoutCommand(bot).register())
    commands = commands.concat(new ClipCommand(bot).register())
    commands = commands.concat(new GetGameCommand(bot).register())
    commands = commands.concat(new ToggleErrorMessageCommand(bot).register())
    commands = commands.concat(new TTSCommand(bot).register())

    // configured commands
    commands = buildConfigCommands(commands)

    commands.push(buildOverviewCommand(commands))

    return commands
}

function buildOverviewCommand(commands: any[]) {
    let commandList = ''

    for (const command of commands) {
        commandList = `${commandList}, ${command.name}`
    }

    commandList = commandList.substring(1)

    return createBotCommand('commands', (params, { reply }) => {
        void reply(`Es gibt folgende Befehle: ${commandList}`);
    })
}

function buildConfigCommands(commands: any[]) {
    const config = getConfig(/^command /g, true)

    for (const command in config) {
        const commandContent = config[command]

        logRegular(`register command: ${command}`)

        commands.push(buildConfigCommand(command, commandContent))
    }

    return commands
}

function buildConfigCommand(command: string, option: any) {
    return createBotCommand(command, (params, context) => {
        if(option.enforce_primary) {
            const primaryChannel = getPrimaryChannel()

            if(context.broadcasterId !== primaryChannel.id) return
        }

        void context.reply(option.message);
    }, {aliases: option.alias, userCooldown: option.userCooldown, globalCooldown: option.globalCooldown})
}