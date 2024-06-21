import BaseEvent from "./BaseEvent";
import {EventSubChannelCheerEvent} from "@twurple/eventsub-base";
import {getAssetConfig} from "../../../../helper/ConfigHelper";
import {waitUntil} from "async-wait-until";
import {isEventQueried} from "../../helper/CooldownHelper";
import {addAlert} from "../../../../helper/AlertHelper";

export default class BitEvent extends BaseEvent {
    name = 'Bits'
    eventTypes = ['onChannelCheer']


    async handle(event: EventSubChannelCheerEvent) {
        const theme = getAssetConfig('bits')

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