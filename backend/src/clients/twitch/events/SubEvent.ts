import BaseEvent from "./BaseEvent";
import {SubEvent as EasyEvent} from "@twurple/easy-bot";
import getWebsocketServer from "../../../App";
import {waitUntil} from "async-wait-until";
import {hasEventHash, isEventQueried} from "../helper/CooldownHelper";
import {getConfig} from "../../../helper/ConfigHelper";

export default class SubEvent extends BaseEvent {
    name = 'Sub'
    eventTypes = ['onSub', 'onResub']

    async handle(event: EasyEvent) {
       // getWebsocketServer().send('twitch_sub', {
      //      message: event.message,
       //     months: event.months,
      //      streak: event.streak,
       //     userName: event.userDisplayName,
      //      prime: event.isPrime,
      //      plan: event.plan,
//})
        const config = getConfig(/theme/g)[0]

        getWebsocketServer().send('show_alert', {
            'duration': 15,
            'color': config.sub_color,
            'icon': 'star-outline',
            'message': `${event.userDisplayName} abonniert im ${event.months}. Monat auf Stufe ${event.plan}`,
            'event-uuid': this.eventUuid
        })

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: 30_000})
    }
}