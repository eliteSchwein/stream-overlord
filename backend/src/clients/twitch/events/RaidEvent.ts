import BaseEvent from "./BaseEvent";
import {RaidEvent as EasyEvent} from "@twurple/easy-bot/lib/events/RaidEvent";
import {getAssetConfig, getConfig} from "../../../helper/ConfigHelper";
import {waitUntil} from "async-wait-until";
import {isEventQueried} from "../helper/CooldownHelper";
import {addAlert} from "../../../helper/AlertHelper";
import {logRegular} from "../../../helper/LogHelper";

export default class RaidEvent extends BaseEvent {
    name = 'Raid'
    eventTypes = ['onRaid']

    async handle(event: EasyEvent) {
        const theme = getAssetConfig('raid')

        logRegular(`raid from ${event.userDisplayName} with ${event.viewerCount} viewers`)

        addAlert({
            'sound': theme.sound,
            'duration': 15,
            'color': theme.color,
            'icon': theme.icon,
            'message': `${event.userDisplayName} raidet mit ${event.viewerCount}. Leuten`,
            'event-uuid': this.eventUuid,
            'video': theme.video
        })

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: 30_000})

        const primaryChannel = await this.bot.api.users.getUserByName(
            getConfig(/twitch/g)[0]['channels'][0])

        await this.bot.api.chat.sendChatMessage(primaryChannel, `!so ${event.userName}`)
    }
}