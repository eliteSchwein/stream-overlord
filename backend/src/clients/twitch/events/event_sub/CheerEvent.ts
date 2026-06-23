import BaseEvent from "./BaseEvent";
import {EventSubChannelCheerEvent} from "@twurple/eventsub-base";
import {WAIT_FOREVER, waitUntil} from "async-wait-until";
import {isEventQueried} from "../../helper/CooldownHelper";
import {logRegular, logWarn} from "../../../../helper/LogHelper";
import isShieldActive from "../../../../helper/ShieldHelper";

export default class CheerEvent extends BaseEvent {
    name = 'Bits'
    eventTypes = ['onChannelCheer']
    configName = "event_twitch_cheer"


    async handle(event: EventSubChannelCheerEvent) {
        logRegular(`${event.bits} bits from ${event.userDisplayName}`)

        if(isShieldActive()) {
            logWarn('Shield mode active!')
            return
        }

        await this.triggerConfiguredEvent(event)

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: WAIT_FOREVER})
    }
}