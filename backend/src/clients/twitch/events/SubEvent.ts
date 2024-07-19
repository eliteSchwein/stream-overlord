import BaseEvent from "./BaseEvent";
import {SubEvent as EasyEvent} from "@twurple/easy-bot";
import {waitUntil} from "async-wait-until";
import {isEventQueried} from "../helper/CooldownHelper";
import {getAssetConfig} from "../../../helper/ConfigHelper";
import {addAlert} from "../../../helper/AlertHelper";
import {logRegular} from "../../../helper/LogHelper";

export default class SubEvent extends BaseEvent {
    name = 'Sub'
    eventTypes = ['onSub', 'onResub']

    async handle(event: EasyEvent) {
        const theme = getAssetConfig('sub')

        logRegular(`sub from ${event.userDisplayName} in ${event.months} month on tier ${event.plan}`)

        addAlert({
            'sound': theme.sound,
            'duration': 15,
            'color': theme.color,
            'icon': theme.icon,
            'message': `${event.userDisplayName} abonniert im ${event.months}. Monat auf Stufe ${event.plan}`,
            'event-uuid': this.eventUuid,
            'video': theme.video
        })

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: 600_000})
    }
}