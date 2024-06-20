import BaseEvent from "./BaseEvent";
import {EventSubChannelCheerEvent} from "@twurple/eventsub-base";
import {getConfig} from "../../../../helper/ConfigHelper";
import {waitUntil} from "async-wait-until";
import {isEventQueried} from "../../helper/CooldownHelper";
import {addAlert} from "../../../../helper/AlertHelper";

export default class BitEvent extends BaseEvent {
    name = 'Bits'
    eventTypes = ['onChannelCheer']


    async handle(event: EventSubChannelCheerEvent) {
        const theme = getConfig(/asset bits/g)[0]

        addAlert({
            'sound': theme.sound,
            'duration': 15,
            'color': theme.color,
            'icon': theme.icon,
            'message': `${event.userDisplayName} haut ${event.bits} Bits raus`,
            'event-uuid': this.eventUuid,
            'video': theme.video
        })

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: 30_000})
    }
}