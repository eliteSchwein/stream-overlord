import {getConfig} from "../helper/ConfigHelper";
import {createBotCommand} from "@twurple/easy-bot";
import InfoCommand from "./twitch/InfoCommand";
import {logRegular} from "../helper/LogHelper";

export default function buildCommands() {
    let commands = []

    // coded commands
    commands = commands.concat(new InfoCommand().register())

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

        commands.push(buildConfigCommand(command, commandContent.message))

        for (const alias of commandContent.alias) {
            logRegular(`register alias ${alias} for command: ${command}`)
            commands.push(buildConfigCommand(alias, commandContent.message))
        }
    }

    return commands
}

function buildConfigCommand(command: string, message: string) {
    return createBotCommand(command, (params, { reply }) => {
        void reply(message);
    })
}