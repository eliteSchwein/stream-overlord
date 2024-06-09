import {getConfig} from "../helper/ConfigHelper";
import {createBotCommand} from "@twurple/easy-bot";

export default function buildCommands() {
    let commands = []

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

        commands.push(buildConfigCommand(command, commandContent.message))

        for (const alias of commandContent.alias) {
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