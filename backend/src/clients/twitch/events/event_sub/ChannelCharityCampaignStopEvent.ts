import BaseEvent from "./BaseEvent";
import {getPrimaryChannel} from "../../../../helper/ConfigHelper";
import {waitUntil} from "async-wait-until";
import {isEventQueried} from "../../helper/CooldownHelper";
import {logRegular, logWarn} from "../../../../helper/LogHelper";
import isShieldActive from "../../../../helper/ShieldHelper";

export default class ChannelCharityCampaignStopEvent extends BaseEvent {
    name = 'ChannelCharityCampaignStop'
    configName = 'event_twitch_charity_campaign_stop'
    eventTypes = []

    async handleRegister() {
        const primaryChannel = getPrimaryChannel()

        this.eventSubWs.onChannelCharityCampaignStop(primaryChannel, (event: any) => this.handleEvent(event))
    }

    async handle(event: any) {
        logRegular(`charity campaign stop`)

        if(isShieldActive()) {
            logWarn('Shield mode active!')
            return
        }

        await this.triggerConfiguredEvent(event)

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: 600_000})
    }
}
