import BaseEvent from "./BaseEvent";
import {CommunitySubEvent as EasyEvent} from "@twurple/easy-bot";
import {WAIT_FOREVER, waitUntil} from "async-wait-until";
import {isEventQueried} from "../helper/CooldownHelper";
import {logRegular, logWarn} from "../../../helper/LogHelper";
import isShieldActive from "../../../helper/ShieldHelper";
import {registerCommunitySubGift} from "../../../helper/CommunitySubGiftHelper";

export default class CommunitySubEvent extends BaseEvent {
    name = 'CommunitySub'
    eventTypes = ['onCommunitySub']
    configName = 'event_twitch_community_sub'


    simulationFields = [
        { name: 'gifterId', type: 'text' as const, localeKey: 'events.simulation.fields.gifterId', default: '987654321' },
        { name: 'gifterDisplayName', type: 'text' as const, localeKey: 'events.simulation.fields.gifterDisplayName', default: 'TestGifter' },
        { name: 'count', type: 'number' as const, localeKey: 'events.simulation.fields.count', default: 5, min: 1, step: 1, required: true },
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
    ]

    protected async shouldHandleEvent(event: EasyEvent): Promise<boolean> {
        // Register the community summary before this event itself enters the
        // normal lifecycle, so any buffered recipient SubGift events can be
        // released/suppressed immediately.
        if (event.count <= 1) return false

        registerCommunitySubGift(event)
        return true
    }

    async handle(event: EasyEvent) {
        let plan = event.plan

        if(!isNaN(Number.parseInt(plan))) {
            plan = `${Number.parseInt(plan)/1000}`
        }

        logRegular(`${event.count} subs gifted from ${event.gifterDisplayName} on tier ${plan}`)

        if(isShieldActive()) {
            logWarn('Shield mode active!')
            return
        }

        await this.triggerConfiguredEvent(event)

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: WAIT_FOREVER})
    }
}