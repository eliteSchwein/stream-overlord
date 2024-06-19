import BaseEvent from "./BaseEvent";
import {RaidEvent as EasyEvent} from "@twurple/easy-bot/lib/events/RaidEvent";
import {getConfig} from "../../../helper/ConfigHelper";
import getWebsocketServer from "../../../App";
import {waitUntil} from "async-wait-until";
import {isEventQueried} from "../helper/CooldownHelper";

export default class RaidEvent extends BaseEvent {
    name = 'Raid'
    eventTypes = ['onRaid']

    async handle(event: EasyEvent) {
        const theme = getConfig(/asset raid/g)[0]

        getWebsocketServer().send('show_alert', {
            'sound': theme.sound,
            'duration': 15,
            'color': theme.color,
            'icon': theme.icon,
            'message': `${event.userDisplayName} raidet mit ${event.viewerCount}. Leuten`,
            'event-uuid': this.eventUuid,
            'video': theme.video
        })

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: 30_000})
    }
}