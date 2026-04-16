import BaseEvent from "./BaseEvent";
import {RaidEvent as EasyEvent} from "@twurple/easy-bot/lib/events/RaidEvent";
import {getPrimaryChannel} from "../../../helper/ConfigHelper";
import {WAIT_FOREVER, waitUntil} from "async-wait-until";
import {isEventQueried} from "../helper/CooldownHelper";
import {logRegular, logWarn} from "../../../helper/LogHelper";
import isShieldActive from "../../../helper/ShieldHelper";
import {triggerMacro} from "../../../helper/MacroHelper";

export default class RaidEvent extends BaseEvent {
    name = 'Raid'
    eventTypes = ['onRaid']

    async handle(event: EasyEvent) {

        logRegular(`raid from ${event.userDisplayName} with ${event.viewerCount} viewers`)

        if(isShieldActive()) {
            logWarn('Shield mode active!')
            return
        }

        await triggerMacro('raid', {event: event, eventUuid: this.eventUuid})

        //addAlert({
        //    'sound': theme.sound,
        //    'duration': 15,
        //    'color': theme.color,
        //    'icon': theme.icon,
        //    'message': `${event.userDisplayName} raidet mit ${event.viewerCount}. Leuten`,
        //    'event-uuid': this.eventUuid,
        //    'video': theme.video,
        //    'lamp_color': theme.lamp_color,
        //    'volume': theme.volume,
        //    'image': theme.image,
        //    'channel': theme.channel,
        //})

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: WAIT_FOREVER})

        const primaryChannel = getPrimaryChannel()

        await this.bot.api.chat.sendChatMessage(primaryChannel, `!so ${event.userName}`)
    }
}