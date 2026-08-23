import BaseEvent from "./BaseEvent";
import {SubGiftEvent as EasyEvent} from "@twurple/easy-bot";
import {WAIT_FOREVER, waitUntil} from "async-wait-until";
import {isEventQueried} from "../helper/CooldownHelper";
import {logRegular, logWarn} from "../../../helper/LogHelper";
import isShieldActive from "../../../helper/ShieldHelper";
import {consumeCommunitySubGift} from "../../../helper/CommunitySubGiftHelper";

export default class SubGiftEvent extends BaseEvent {
    name = 'SubGift'
    eventTypes = ['onSubGift']
    configName = 'event_twitch_subgift'


    simulationFields = [
        { name: 'gifterId', type: 'text' as const, localeKey: 'events.simulation.fields.gifterId', default: '987654321' },
        { name: 'gifterDisplayName', type: 'text' as const, localeKey: 'events.simulation.fields.gifterDisplayName', default: 'TestGifter' },
        { name: 'userId', type: 'text' as const, localeKey: 'events.simulation.fields.userId', default: '456789123', required: true },
        { name: 'userDisplayName', type: 'text' as const, localeKey: 'events.simulation.fields.userDisplayName', default: 'GiftRecipient', required: true },
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
        { name: 'months', type: 'number' as const, localeKey: 'events.simulation.fields.months', default: 1, min: 1, step: 1, required: true },
    ]

    async handle(event: EasyEvent) {
        // Community gifts also emit one SubGift event per recipient. Consume
        // those here so only the CommunitySub event triggers assets/macros.
        if (consumeCommunitySubGift(event)) {
            return
        }

        let plan = event.plan

        if(!isNaN(Number.parseInt(plan))) {
            plan = `${Number.parseInt(plan)/1000}`
        }

        logRegular(`sub gift from ${event.gifterDisplayName} to ${event.userDisplayName} in ${event.months} month on tier ${plan}`)

        if(isShieldActive()) {
            logWarn('Shield mode active!')
            return
        }

        await this.triggerConfiguredEvent(event)

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: WAIT_FOREVER})
    }
}