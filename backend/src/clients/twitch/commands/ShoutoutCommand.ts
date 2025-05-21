import BaseCommand from "./BaseCommand";
import {BotCommandContext} from "@twurple/easy-bot";
import {getConfig, getPrimaryChannel} from "../../../helper/ConfigHelper";
import {logRegular, logWarn} from "../../../helper/LogHelper";
import {addAlert, isAlertActive} from "../../../helper/AlertHelper";
import getWebsocketServer from "../../../App";
import {WAIT_FOREVER, waitUntil} from "async-wait-until";
import {isEventQueried} from "../helper/CooldownHelper";
import {v4 as uuidv4} from "uuid";

export default class ShoutoutCommand extends BaseCommand {
    command = 'shoutout'
    aliases: string[] = ['so']
    requiresMod = true
    params = [
        {
            name: 'userName',
            type: 'user'
        },
    ]
    enforceSame = true

    async handle(params: any, context: BotCommandContext) {
        if(isAlertActive('shoutout')) {
            await context.reply('Es ist gerade ein Shoutout aktiv!')
            return
        }

        await waitUntil(() => !isAlertActive(), {timeout: WAIT_FOREVER})

        const user = await this.bot.api.users.getUserByName(params.userName)

        if(!user) {
            await context.reply('Dieses Benutzer wurde leider nicht gefunden')
            return
        }

        const channelInfo = await this.bot.api.channels.getChannelInfoById(user)

        const primaryChannel = getPrimaryChannel()

        try {
            await this.bot.api.chat.shoutoutUser(primaryChannel, user)
        } catch (error) {
            logWarn('twitch shout failed:')
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
        }

        await context.say(`${user.displayName} hat zuletzt ${channelInfo.gameName} gespielt`)
        await context.say(`checkt denn channel ab -> https://twitch.tv/${user.name}`)

        logRegular(`shout from ${context.userDisplayName} to ${user.displayName}`)

        getWebsocketServer().send('notify_shoutout_clip', {channel: user.name, name: user.displayName})

        addAlert({
            'logo': user.profilePictureUrl,
            'dummy': true,
            'duration': 30,
            'icon': '',
            'message': ``,
            'event-uuid': `shoutout_${uuidv4()}`
        })
    }
}