import BaseEvent from "./BaseEvent";
import {getPrimaryChannel} from "../../../../helper/ConfigHelper";
import {waitUntil} from "async-wait-until";
import {isEventQueried} from "../../helper/CooldownHelper";
import {logRegular, logWarn} from "../../../../helper/LogHelper";
import isShieldActive from "../../../../helper/ShieldHelper";

export default class ChannelHypeTrainEndEvent extends BaseEvent {
    name = 'ChannelHypeTrainEnd'
    configName = 'event_twitch_hype_train_end'
    eventTypes = []

    simulationFields = [
        { name: 'id', type: 'text' as const, localeKey: 'events.simulation.fields.hypeTrainId', default: 'test-hype-train' },
        { name: 'type', type: 'text' as const, localeKey: 'events.simulation.fields.hypeTrainType', default: 'regular' },
        { name: 'level', type: 'number' as const, localeKey: 'events.simulation.fields.level', default: 3, min: 1, step: 1 },
        { name: 'total', type: 'number' as const, localeKey: 'events.simulation.fields.total', default: 750, min: 0, step: 1 },
        { name: 'isSharedTrain', type: 'boolean' as const, localeKey: 'events.simulation.fields.isSharedTrain', default: false },
        { name: 'startDate', type: 'text' as const, localeKey: 'events.simulation.fields.startDate', default: '2026-08-23T19:40:00.000Z' },
        { name: 'endDate', type: 'text' as const, localeKey: 'events.simulation.fields.endDate', default: '2026-08-23T19:50:00.000Z' },
        { name: 'cooldownEndDate', type: 'text' as const, localeKey: 'events.simulation.fields.cooldownEndDate', default: '2026-08-23T20:50:00.000Z' },
        { name: 'topContributors', type: 'textarea' as const, localeKey: 'events.simulation.fields.topContributors', default: '[]', json: true },
        { name: 'sharedTrainParticipants', type: 'textarea' as const, localeKey: 'events.simulation.fields.sharedTrainParticipants', default: '[]', json: true },
    ]

    async handleRegister() {
        const primaryChannel = getPrimaryChannel()

        // Twitch removed/invalidated the old v1 subscription here.
        // Use EventSub channel.hype_train.end v2.
        this.eventSubWs.onChannelHypeTrainEndV2(primaryChannel.id, (event: any) => this.handleEvent(event))
    }

    async handle(event: any) {
        const id = String(event?.id ?? '').trim() || undefined
        const trackedId = this.twitchClient?.getHypeTrainId()

        if (!id || !trackedId || trackedId === id) {
            this.twitchClient?.resetHypeTrainLevel()
        } else {
            logRegular(`ignore stale hype train end for ${id}; active train is ${trackedId}`)
        }

        logRegular(`hype train end`)

        if(isShieldActive()) {
            logWarn('Shield mode active!')
            return
        }

        await this.triggerConfiguredEvent(event)

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: 600_000})
    }
}
