import BaseEvent from "./BaseEvent";
import {SubGiftEvent as EasyEvent} from "@twurple/easy-bot";
import getWebsocketServer from "../../../App";

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
    }
}