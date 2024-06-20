import BaseEvent from "./BaseEvent";
import {SubGiftEvent as EasyEvent} from "@twurple/easy-bot";
import {waitUntil} from "async-wait-until";
import {isEventQueried} from "../helper/CooldownHelper";
import {getConfig} from "../../../helper/ConfigHelper";
import {addAlert} from "../../../helper/AlertHelper";

export default class SubGiftEvent extends BaseEvent {
    name = 'SubGift'
    eventTypes = ['onSubGift']

    async handle(event: EasyEvent) {
        const theme = getConfig(/asset sub/g)[0]

        addAlert({
            'sound': theme.sound,
            'duration': 15,
            'color': theme.color,
            'icon': theme.icon,
            'message': `${event.gifterDisplayName} schenkt ${event.userDisplayName} ein Abo auf Stufe ${event.plan}`,
            'event-uuid': this.eventUuid,
            'video': theme.video
        })

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: 30_000})
    }
}