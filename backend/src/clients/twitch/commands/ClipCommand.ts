import BaseCommand from "./BaseCommand";
import {BotCommandContext} from "@twurple/easy-bot";
import {getConfig} from "../../../helper/ConfigHelper";

export default class ClipCommand extends BaseCommand{
    command = 'clip'
    globalCooldown = 10
    userCooldown = 15

    async handle(params: any, context: BotCommandContext) {
        const primaryChannel = await this.bot.api.users.getUserByName(
            getConfig(/twitch/g)[0]['channels'][0])

        const clipId = await this.bot.api.clips.createClip({channel: primaryChannel, createAfterDelay: true})

        await context.say(`created clip: https://www.twitch.tv/${primaryChannel.name}/clip/${clipId}`)
    }
}