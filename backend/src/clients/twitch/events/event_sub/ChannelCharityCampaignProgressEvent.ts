import BaseEvent from "./BaseEvent";
import {getPrimaryChannel} from "../../../../helper/ConfigHelper";
import {waitUntil} from "async-wait-until";
import {isEventQueried} from "../../helper/CooldownHelper";
import {logRegular, logWarn} from "../../../../helper/LogHelper";
import isShieldActive from "../../../../helper/ShieldHelper";

export default class ChannelCharityCampaignProgressEvent extends BaseEvent {
    name = 'ChannelCharityCampaignProgress'
    configName = 'event_twitch_charity_campaign_progress'
    eventTypes = []

    simulationFields = [
        { name: 'id', type: 'text' as const, localeKey: 'events.simulation.fields.campaignId', default: 'charity-campaign-test', required: true },
        { name: 'charityName', type: 'text' as const, localeKey: 'events.simulation.fields.charityName', default: 'Test Charity', required: true },
        { name: 'charityDescription', type: 'textarea' as const, localeKey: 'events.simulation.fields.charityDescription', default: 'A test charity campaign.' },
        { name: 'charityLogo', type: 'text' as const, localeKey: 'events.simulation.fields.charityLogo', default: 'https://example.com/charity.png' },
        { name: 'charityWebsite', type: 'text' as const, localeKey: 'events.simulation.fields.charityWebsite', default: 'https://example.com' },
        { name: 'currentAmount', type: 'textarea' as const, localeKey: 'events.simulation.fields.currentAmount', default: '{"value":2500,"decimalPlaces":2,"currency":"EUR"}', json: true, required: true },
        { name: 'targetAmount', type: 'textarea' as const, localeKey: 'events.simulation.fields.targetAmount', default: '{"value":10000,"decimalPlaces":2,"currency":"EUR"}', json: true, required: true },
    ]

    async handleRegister() {
        const primaryChannel = getPrimaryChannel()

        this.eventSubWs.onChannelCharityCampaignProgress(primaryChannel, (event: any) => this.handleEvent(event))
    }

    async handle(event: any) {
        logRegular(`charity campaign progress`)

        if(isShieldActive()) {
            logWarn('Shield mode active!')
            return
        }

        await this.triggerConfiguredEvent(event)

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: 600_000})
    }
}
