import BaseEvent from "./BaseEvent";
import {SubEvent as EasyEvent} from "@twurple/easy-bot";
import getWebsocketServer from "../../../App";

export default class SubEvent extends BaseEvent {
    name = 'Sub'
    eventTypes = ['onSub', 'onResub']

    async handle(event: EasyEvent) {
        getWebsocketServer().send('twitch_sub', {
            message: event.message,
            months: event.months,
            streak: event.streak,
            userName: event.userDisplayName,
            prime: event.isPrime,
            plan: event.plan,
        })
    }
}