import BaseEvent from "./BaseEvent";
import {getPrimaryChannel} from "../../../../helper/ConfigHelper";
import {waitUntil} from "async-wait-until";
import {isEventQueried} from "../../helper/CooldownHelper";
import {logRegular, logWarn} from "../../../../helper/LogHelper";
import isShieldActive from "../../../../helper/ShieldHelper";

export default class ChannelCharityDonationEvent extends BaseEvent {
    name = 'ChannelCharityDonation'
    configName = 'event_twitch_charity_donation'
    eventTypes = []

    simulationFields = [
        { name: 'id', type: 'text' as const, localeKey: 'events.simulation.fields.donationId', default: 'charity-donation-test', required: true },
        { name: 'campaignId', type: 'text' as const, localeKey: 'events.simulation.fields.campaignId', default: 'charity-campaign-test', required: true },
        { name: 'userId', type: 'text' as const, localeKey: 'events.simulation.fields.userId', default: '987654321', required: true },
        { name: 'userDisplayName', type: 'text' as const, localeKey: 'events.simulation.fields.userDisplayName', default: 'TestDonor', required: true },
        { name: 'amount', type: 'textarea' as const, localeKey: 'events.simulation.fields.amount', default: '{"value":500,"decimalPlaces":2,"currency":"EUR"}', json: true, required: true },
    ]

    async handleRegister() {
        const primaryChannel = getPrimaryChannel()

        this.eventSubWs.onChannelCharityDonation(primaryChannel, (event: any) => this.handleEvent(event))
    }

    async handle(event: any) {
        logRegular(`charity donation`)

        if(isShieldActive()) {
            logWarn('Shield mode active!')
            return
        }

        await this.triggerConfiguredEvent(event)

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: 600_000})
    }
}
