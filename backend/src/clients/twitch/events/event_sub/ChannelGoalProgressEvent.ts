import BaseEvent from "./BaseEvent";
import {getPrimaryChannel} from "../../../../helper/ConfigHelper";
import {waitUntil} from "async-wait-until";
import {isEventQueried} from "../../helper/CooldownHelper";
import {logRegular, logWarn} from "../../../../helper/LogHelper";
import isShieldActive from "../../../../helper/ShieldHelper";

export default class ChannelGoalProgressEvent extends BaseEvent {
    name = 'ChannelGoalProgress'
    configName = 'event_twitch_goal_progress'
    eventTypes = []

    async handleRegister() {
        const primaryChannel = getPrimaryChannel()

        this.eventSubWs.onChannelGoalProgress(primaryChannel, (event: any) => this.handleEvent(event))
    }

    async handle(event: any) {
        logRegular(`goal progress`)

        if(isShieldActive()) {
            logWarn('Shield mode active!')
            return
        }

        await this.triggerConfiguredEvent(event)

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: 600_000})
    }
}
