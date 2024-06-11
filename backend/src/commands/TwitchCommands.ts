import {getConfig} from "../helper/ConfigHelper";
import {Bot, createBotCommand} from "@twurple/easy-bot";
import InfoCommand from "./twitch/InfoCommand";
import {logRegular} from "../helper/LogHelper";

export default function buildCommands(bot: Bot) {
    let commands = []

    // coded commands
    commands = commands.concat(new InfoCommand(bot).register())

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

        commands.push(buildConfigCommand(command, commandContent.message, commandContent.alias))
    }

    return commands
}

function buildConfigCommand(command: string, message: string, aliases: []) {
    return createBotCommand(command, (params, { reply }) => {
        void reply(message);
    }, {aliases: aliases})
}