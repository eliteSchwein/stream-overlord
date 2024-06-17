import BaseEvent from "./BaseEvent";
import {SubGiftEvent as EasyEvent} from "@twurple/easy-bot";
import getWebsocketServer from "../../../App";
import {waitUntil} from "async-wait-until";
import {hasEventHash, isEventQueried} from "../helper/CooldownHelper";
import {getConfig} from "../../../helper/ConfigHelper";

export default class SubGiftEvent extends BaseEvent {
    name = 'SubGift'
    eventTypes = ['onSubGift']

    async handle(event: EasyEvent) {
        getWebsocketServer().send('twitch_sub_gift', {
            months: event.months,
            streak: event.streak,
            userName: event.userDisplayName,
            plan: event.plan,
            gifterName: event.gifterDisplayName
        })
        const config = getConfig(/theme/g)[0]

        getWebsocketServer().send('show_alert', {
            'duration': 15,
            'color': config.sub_color,
            'icon': 'gift-outline',
            'message': `${event.gifterDisplayName} schenkt ${event.userDisplayName} ein Abo auf Stufe ${event.plan}`,
            'event-uuid': this.eventUuid
        })

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: 30_000})
    }
}