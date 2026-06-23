import BaseEvent from "./BaseEvent";
import {getPrimaryChannel} from "../../../../helper/ConfigHelper";
import {waitUntil} from "async-wait-until";
import {isEventQueried} from "../../helper/CooldownHelper";
import {logRegular, logWarn} from "../../../../helper/LogHelper";
import isShieldActive from "../../../../helper/ShieldHelper";

export default class ChannelVipAddEvent extends BaseEvent {
    name = 'ChannelVipAdd'
    configName = 'event_twitch_vip_add'
    eventTypes = []

    async handleRegister() {
        const primaryChannel = getPrimaryChannel()

        this.eventSubWs.onChannelVipAdd(primaryChannel, (event: any) => this.handleEvent(event))
    }

    async handle(event: any) {
        logRegular(`vip added`)

        if(isShieldActive()) {
            logWarn('Shield mode active!')
            return
        }

        await this.triggerConfiguredEvent(event)

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: 600_000})
    }
}
