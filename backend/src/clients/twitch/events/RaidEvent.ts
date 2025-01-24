import BaseEvent from "./BaseEvent";
import {RaidEvent as EasyEvent} from "@twurple/easy-bot/lib/events/RaidEvent";
import {getAssetConfig, getConfig} from "../../../helper/ConfigHelper";
import {WAIT_FOREVER, waitUntil} from "async-wait-until";
import {isEventQueried} from "../helper/CooldownHelper";
import {addAlert} from "../../../helper/AlertHelper";
import {logRegular, logWarn} from "../../../helper/LogHelper";
import isShieldActive from "../../../helper/ShieldHelper";

export default class RaidEvent extends BaseEvent {
    name = 'Raid'
    eventTypes = ['onRaid']

    async handle(event: EasyEvent) {
        const theme = getAssetConfig('raid')

        logRegular(`raid from ${event.userDisplayName} with ${event.viewerCount} viewers`)

        if(isShieldActive()) {
            logWarn('Shield mode active!')
            return
        }

        addAlert({
            'sound': theme.sound,
            'duration': 15,
            'color': theme.color,
            'icon': theme.icon,
            'message': `${event.userDisplayName} raidet mit ${event.viewerCount}. Leuten`,
            'event-uuid': this.eventUuid,
            'video': theme.video,
            'lamp_color': theme.lamp_color
        })

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: WAIT_FOREVER})

        const primaryChannel = await this.bot.api.users.getUserByName(
            getConfig(/twitch/g)[0]['channels'][0])

        await this.bot.api.chat.sendChatMessage(primaryChannel, `!so ${event.userName}`)
    }
}