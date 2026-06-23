import BaseEvent from "./BaseEvent";
import {getPrimaryChannel} from "../../../../helper/ConfigHelper";
import {waitUntil} from "async-wait-until";
import {isEventQueried} from "../../helper/CooldownHelper";
import {logRegular, logWarn} from "../../../../helper/LogHelper";
import isShieldActive from "../../../../helper/ShieldHelper";

export default class ChannelHypeTrainBeginEvent extends BaseEvent {
    name = 'ChannelHypeTrainBegin'
    configName = 'event_twitch_hype_train_begin'
    eventTypes = []

    async handleRegister() {
        const primaryChannel = getPrimaryChannel()

        // Twitch removed/invalidated the old v1 subscription here.
        // Use EventSub channel.hype_train.begin v2.
        this.eventSubWs.onChannelHypeTrainBeginV2(primaryChannel.id, (event: any) => this.handleEvent(event))
    }

    async handle(event: any) {
        logRegular(`hype train begin`)

        if(isShieldActive()) {
            logWarn('Shield mode active!')
            return
        }

        await this.triggerConfiguredEvent(event)

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: 600_000})
    }
}
