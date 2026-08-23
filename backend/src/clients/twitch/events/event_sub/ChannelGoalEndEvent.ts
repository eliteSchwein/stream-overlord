import BaseEvent from "./BaseEvent";
import {getPrimaryChannel} from "../../../../helper/ConfigHelper";
import {waitUntil} from "async-wait-until";
import {isEventQueried} from "../../helper/CooldownHelper";
import {logRegular, logWarn} from "../../../../helper/LogHelper";
import isShieldActive from "../../../../helper/ShieldHelper";

export default class ChannelGoalEndEvent extends BaseEvent {
    name = 'ChannelGoalEnd'
    configName = 'event_twitch_goal_end'
    eventTypes = []

    simulationFields = [
        { name: 'id', type: 'text' as const, localeKey: 'events.simulation.fields.goalId', default: 'goal-test', required: true },
        { name: 'type', type: 'text' as const, localeKey: 'events.simulation.fields.goalType', default: 'follower', required: true },
        { name: 'description', type: 'textarea' as const, localeKey: 'events.simulation.fields.description', default: 'Test goal', required: true },
        { name: 'currentAmount', type: 'number' as const, localeKey: 'events.simulation.fields.currentAmount', default: 100, min: 0, step: 1, required: true },
        { name: 'targetAmount', type: 'number' as const, localeKey: 'events.simulation.fields.targetAmount', default: 100, min: 0, step: 1, required: true },
        { name: 'startDate', type: 'text' as const, localeKey: 'events.simulation.fields.startDate', default: '2026-08-23T20:00:00.000Z', required: true },
        { name: 'endDate', type: 'text' as const, localeKey: 'events.simulation.fields.endDate', default: '2026-08-23T20:30:00.000Z', required: true },
        { name: 'isAchieved', type: 'boolean' as const, localeKey: 'events.simulation.fields.isAchieved', default: true, required: true },
    ]

    async handleRegister() {
        const primaryChannel = getPrimaryChannel()

        this.eventSubWs.onChannelGoalEnd(primaryChannel, (event: any) => this.handleEvent(event))
    }

    async handle(event: any) {
        logRegular(`goal end`)

        if(isShieldActive()) {
            logWarn('Shield mode active!')
            return
        }

        await this.triggerConfiguredEvent(event)

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: 600_000})
    }
}
