import BaseEvent from "./BaseEvent";
import {SubEvent as EasyEvent} from "@twurple/easy-bot";
import getWebsocketServer from "../../../App";
import {waitUntil} from "async-wait-until";
import {hasEventHash, isEventQueried} from "../helper/CooldownHelper";
import {getConfig} from "../../../helper/ConfigHelper";
import {addAlert} from "../../../helper/AlertHelper";

export default class SubEvent extends BaseEvent {
    name = 'Sub'
    eventTypes = ['onSub', 'onResub']

    async handle(event: EasyEvent) {
        const theme = getConfig(/asset sub/g)[0]

        addAlert({
            'sound': theme.sound,
            'duration': 15,
            'color': theme.color,
            'icon': theme.icon,
            'message': `${event.userDisplayName} abonniert im ${event.months}. Monat auf Stufe ${event.plan}`,
            'event-uuid': this.eventUuid,
            'video': theme.video
        })

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: 30_000})
    }
}