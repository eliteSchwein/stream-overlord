import BaseCommand from "./BaseCommand";
import {BotCommandContext} from "@twurple/easy-bot";
import {getSystemInfo} from "../../../helper/SystemInfoHelper";
import {getConfig} from "../../../helper/ConfigHelper";

export default class InfoCommand extends BaseCommand{
    command = 'info'

    async handle(params: any, context: BotCommandContext) {
        const systemInfo = getSystemInfo()

        if(systemInfo.length > 0) {
            const config = getConfig(/systeminfo/g)[0]
            let systemInfoMessage = config.message

            for(const entry of systemInfo) {
                systemInfoMessage = `${systemInfoMessage} ${entry.label} ${entry.data}${config.message_spacer}`
            }

            systemInfoMessage = systemInfoMessage.substring(0, systemInfoMessage.length - config.message_spacer.length)
            await context.reply(systemInfoMessage)
        }

        await context.reply("Ich nutze ein selbst geschriebenen Bot welcher open source ist: https://github.com/eliteSchwein/stream-overlord/")
    }
}