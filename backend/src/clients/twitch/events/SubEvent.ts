import BaseEvent from "./BaseEvent";
import {SubEvent as EasyEvent} from "@twurple/easy-bot";
import {WAIT_FOREVER, waitUntil} from "async-wait-until";
import {isEventQueried} from "../helper/CooldownHelper";
import {logRegular, logWarn} from "../../../helper/LogHelper";
import isShieldActive from "../../../helper/ShieldHelper";
import {triggerMacro} from "../../../helper/MacroHelper";

export default class SubEvent extends BaseEvent {
    name = 'Sub'
    eventTypes = ['onSub', 'onResub']

    async handle(event: EasyEvent) {
        let plan = event.plan

        if(!isNaN(Number.parseInt(plan))) {
            plan = `${Number.parseInt(plan)/1000}`
        }

        logRegular(`sub from ${event.userDisplayName} in ${event.months} month on tier ${plan}`)

        if(isShieldActive()) {
            logWarn('Shield mode active!')
            return
        }

        await triggerMacro('sub', {event: event, eventUuid: this.eventUuid, plan: plan})

        //addAlert({
        //    'sound': theme.sound,
        //    'duration': 15,
        //    'color': theme.color,
        //    'icon': theme.icon,
        //    'message': `${event.userDisplayName} abonniert im ${event.months}. Monat auf Stufe ${plan}`,
        //    'event-uuid': this.eventUuid,
        //    'video': theme.video,
        //    'lamp_color': theme.lamp_color,
        //    'volume': theme.volume,
        //    'image': theme.image,
        //    'channel': theme.channel,
        //})

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: WAIT_FOREVER})
    }
}