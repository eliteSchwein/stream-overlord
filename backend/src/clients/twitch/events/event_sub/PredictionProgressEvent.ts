import BaseEvent from "./BaseEvent";
import {getPrimaryChannel} from "../../../../helper/ConfigHelper";
import {waitUntil} from "async-wait-until";
import {isEventQueried} from "../../helper/CooldownHelper";
import {logRegular, logWarn} from "../../../../helper/LogHelper";
import isShieldActive from "../../../../helper/ShieldHelper";

export default class PredictionProgressEvent extends BaseEvent {
    name = 'PredictionProgress'
    configName = 'event_twitch_prediction_progress'
    eventTypes = []

    async handleRegister() {
        const primaryChannel = getPrimaryChannel()

        this.eventSubWs.onChannelPredictionProgress(primaryChannel, (event: any) => this.handleEvent(event))
    }

    async handle(event: any) {
        logRegular(`prediction progress`)

        if(isShieldActive()) {
            logWarn('Shield mode active!')
            return
        }

        await this.triggerConfiguredEvent(event)

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: 600_000})
    }
}
