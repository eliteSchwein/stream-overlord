import BaseEvent from "./BaseEvent";
import {CommunitySubEvent as EasyEvent} from "@twurple/easy-bot";
import getWebsocketServer from "../../../App";
import {waitUntil} from "async-wait-until";
import {hasEventHash, isEventQueried} from "../helper/CooldownHelper";
import {getConfig} from "../../../helper/ConfigHelper";

export default class CommunitySubEvent extends BaseEvent {
    name = 'CommunitySub'
    eventTypes = ['onCommunitySub']

    async handle(event: EasyEvent) {
        const config = getConfig(/theme/g)[0]

        getWebsocketServer().send('show_alert', {
            'duration': 15,
            'color': config.sub_color,
            'icon': 'diamond-stone',
            'message': `${event.gifterDisplayName} haut ${event.plan} subs raus`,
            'event-uuid': this.eventUuid
        })

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: 30_000})
    }
}