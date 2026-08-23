import BaseEvent from "./BaseEvent";
import {SubEvent as EasyEvent} from "@twurple/easy-bot";
import {WAIT_FOREVER, waitUntil} from "async-wait-until";
import {isEventQueried} from "../helper/CooldownHelper";
import {logRegular, logWarn} from "../../../helper/LogHelper";
import isShieldActive from "../../../helper/ShieldHelper";

export default class SubEvent extends BaseEvent {
    name = 'Sub'
    eventTypes = ['onSub', 'onResub']
    configName = 'event_twitch_sub'


    simulationFields = [
        { name: 'userId', type: 'text' as const, localeKey: 'events.simulation.fields.userId', default: '987654321', required: true },
        { name: 'userDisplayName', type: 'text' as const, localeKey: 'events.simulation.fields.userDisplayName', default: 'TestSubscriber', required: true },
        {
            name: 'plan',
            type: 'select' as const,
            localeKey: 'events.simulation.fields.plan',
            default: '1000',
            required: true,
            options: [
                { title: 'Prime', value: 'Prime' },
                { title: 'Tier 1', value: '1000' },
                { title: 'Tier 2', value: '2000' },
                { title: 'Tier 3', value: '3000' },
            ],
        },
        {
            name: 'planName',
            type: 'text' as const,
            localeKey: 'events.simulation.fields.planName',
            default: 'Tier 1',
        },
        { name: 'months', type: 'number' as const, localeKey: 'events.simulation.fields.months', default: 3, min: 1, step: 1, required: true },
        { name: 'streak', type: 'number' as const, localeKey: 'events.simulation.fields.streak', default: 3, min: 0, step: 1 },
        { name: 'message', type: 'textarea' as const, localeKey: 'events.simulation.fields.message', default: 'Test resub message' },
        { name: 'isPrime', type: 'boolean' as const, localeKey: 'events.simulation.fields.isPrime', default: false },
        { name: 'wasGift', type: 'boolean' as const, localeKey: 'events.simulation.fields.wasGift', default: false },
        { name: 'wasAnonymousGift', type: 'boolean' as const, localeKey: 'events.simulation.fields.wasAnonymousGift', default: false },
        { name: 'giftRedeemedMonth', type: 'number' as const, localeKey: 'events.simulation.fields.giftRedeemedMonth', default: 0, min: 0, step: 1 },
        { name: 'originalGiftDuration', type: 'number' as const, localeKey: 'events.simulation.fields.originalGiftDuration', default: 0, min: 0, step: 1 },
        { name: 'originalGifterId', type: 'text' as const, localeKey: 'events.simulation.fields.originalGifterId', default: '' },
        { name: 'originalGifterDisplayName', type: 'text' as const, localeKey: 'events.simulation.fields.originalGifterDisplayName', default: '' },
    ]

    async handle(event: EasyEvent) {
let plan = event.plan

        if(!isNaN(Number.parseInt(plan))) {
            plan = `${Number.parseInt(plan)/1000}`
        }

        logRegular(`sub from ${event.userDisplayName} in ${event.months} month on tier ${plan}`)

        if(isShieldActive()) {
            logWarn('Shield mode active!')
            return
        }

        await this.triggerConfiguredEvent(event)

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: WAIT_FOREVER})
    }
}