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


    simulationFields = [
        { name: 'userId', type: 'text' as const, localeKey: 'events.simulation.fields.userId', default: '987654321' },
        { name: 'userDisplayName', type: 'text' as const, localeKey: 'events.simulation.fields.userDisplayName', default: 'TestCheerer' },
        { name: 'bits', type: 'number' as const, localeKey: 'events.simulation.fields.bits', default: 100, min: 1, step: 1, required: true },
        { name: 'message', type: 'textarea' as const, localeKey: 'events.simulation.fields.message', default: 'Test cheer!' },
        { name: 'isAnonymous', type: 'boolean' as const, localeKey: 'events.simulation.fields.isAnonymous', default: false },
    ]


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