import BaseCommand from "./BaseCommand";
import {BotCommandContext} from "@twurple/easy-bot";

export default class InfoCommand extends BaseCommand{
    command = 'info'

    async handle(params: any, context: BotCommandContext) {
        await context.reply("Moin, ich bin botschw31n. eliteSCHW31N's Bot. mein Code findest du hier: https://github.com/eliteSchwein/dynamic-scene/")
    }
}