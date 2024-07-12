import BaseCommand from "./BaseCommand";
import {BotCommandContext} from "@twurple/easy-bot";
import {getConfig} from "../../../helper/ConfigHelper";
import {logRegular, logWarn} from "../../../helper/LogHelper";
import {addAlert} from "../../../helper/AlertHelper";

export default class ShoutoutCommand extends BaseCommand {
    command = 'shoutout'
    aliases: string[] = ['so'];
    requiresMod = true
    params = [
        {
            name: 'userName',
            type: 'user'
        },
    ]

    async handle(params: any, context: BotCommandContext) {
        const user = await this.bot.api.users.getUserByName(params.userName)

        if(!user) {
            await context.reply('Dieses Benutzer wurde leider nicht gefunden')
            return
        }

        const clipUrl = `https://twitch.guru/clipsworks/${user.name}/&period=all&vol=1`

        const primaryChannel = await this.bot.api.users.getUserByName(
            getConfig(/twitch/g)[0]['channels'][0])

        try {
            await this.bot.api.chat.shoutoutUser(primaryChannel, user)
        } catch (error) {
            logWarn('twitch shout failed:')
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
        }

        logRegular(`shout from ${context.userDisplayName} to ${user.displayName}`)

        addAlert({
            'logo': user.profilePictureUrl,
            'iframe': clipUrl,
            'duration': 30,
            'icon': '',
            'message': `checkt ${user.displayName} aus`,
            'event-uuid': `shoutout-${user.id}`
        })
    }
}