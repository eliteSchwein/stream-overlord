import BaseCommand from "./BaseCommand";
import {BotCommandContext} from "@twurple/easy-bot";

export default class InfoCommand extends BaseCommand{
    command = 'info'

    async handle(params: any, context: BotCommandContext) {
        await context.reply("Ich nutze ein selbst geschriebenen Bot welcher open source ist: https://github.com/eliteSchwein/stream-controller/")
    }
}