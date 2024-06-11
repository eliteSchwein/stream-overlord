import {BotCommandContext, createBotCommand} from "@twurple/easy-bot";
import {logRegular} from "../../helper/LogHelper";

export default class BaseCommand {
    protected command = ''
    protected aliases = []

    public register() {
        const commands = []

        logRegular(`register command: ${this.command}`)

        commands.push(createBotCommand(this.command, this.handleCommand))

        for(const alias of this.aliases) {
            logRegular(`register alias ${alias} for command: ${this.command}`)
            commands.push(createBotCommand(alias, this.handleCommand))
        }

        return commands
    }

    protected async handleCommand(param: string[], context: BotCommandContext) {

    }
}