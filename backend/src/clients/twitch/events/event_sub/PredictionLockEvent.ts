import BaseEvent from "./BaseEvent";
import {getPrimaryChannel} from "../../../../helper/ConfigHelper";
import {waitUntil} from "async-wait-until";
import {isEventQueried} from "../../helper/CooldownHelper";
import {logRegular, logWarn} from "../../../../helper/LogHelper";
import isShieldActive from "../../../../helper/ShieldHelper";

export default class PredictionLockEvent extends BaseEvent {
    name = 'PredictionLock'
    configName = 'event_twitch_prediction_lock'
    eventTypes = []

    simulationFields = [
        { name: 'id', type: 'text' as const, localeKey: 'events.simulation.fields.predictionId', default: 'prediction-test', required: true },
        { name: 'title', type: 'text' as const, localeKey: 'events.simulation.fields.title', default: 'Will we win?', required: true },
        { name: 'outcomes', type: 'textarea' as const, localeKey: 'events.simulation.fields.outcomes', default: '[{"id":"outcome-1","title":"Yes","color":"blue","users":10,"channelPoints":5000,"topPredictors":[]},{"id":"outcome-2","title":"No","color":"pink","users":5,"channelPoints":2500,"topPredictors":[]}]', json: true, required: true },
        { name: 'startDate', type: 'text' as const, localeKey: 'events.simulation.fields.startDate', default: '2026-08-23T20:00:00.000Z', required: true },
        { name: 'lockDate', type: 'text' as const, localeKey: 'events.simulation.fields.lockDate', default: '2026-08-23T20:02:00.000Z', required: true },
    ]

    async handleRegister() {
        const primaryChannel = getPrimaryChannel()

        this.eventSubWs.onChannelPredictionLock(primaryChannel, (event: any) => this.handleEvent(event))
    }

    async handle(event: any) {
        logRegular(`prediction locked`)

        if(isShieldActive()) {
            logWarn('Shield mode active!')
            return
        }

        await this.triggerConfiguredEvent(event)

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: 600_000})
    }
}
