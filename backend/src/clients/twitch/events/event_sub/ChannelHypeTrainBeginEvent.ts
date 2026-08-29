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

    simulationFields = [
        { name: 'id', type: 'text' as const, localeKey: 'events.simulation.fields.hypeTrainId', default: 'test-hype-train' },
        { name: 'type', type: 'text' as const, localeKey: 'events.simulation.fields.hypeTrainType', default: 'regular' },
        { name: 'level', type: 'number' as const, localeKey: 'events.simulation.fields.level', default: 1, min: 1, step: 1 },
        { name: 'progress', type: 'number' as const, localeKey: 'events.simulation.fields.progress', default: 25, min: 0, step: 1 },
        { name: 'goal', type: 'number' as const, localeKey: 'events.simulation.fields.goal', default: 100, min: 0, step: 1 },
        { name: 'total', type: 'number' as const, localeKey: 'events.simulation.fields.total', default: 25, min: 0, step: 1 },
        { name: 'allTimeHighLevel', type: 'number' as const, localeKey: 'events.simulation.fields.allTimeHighLevel', default: 5, min: 0, step: 1 },
        { name: 'allTimeHighTotal', type: 'number' as const, localeKey: 'events.simulation.fields.allTimeHighTotal', default: 5000, min: 0, step: 1 },
        { name: 'isSharedTrain', type: 'boolean' as const, localeKey: 'events.simulation.fields.isSharedTrain', default: false },
        { name: 'startDate', type: 'text' as const, localeKey: 'events.simulation.fields.startDate', default: '2026-08-23T19:50:00.000Z' },
        { name: 'expiryDate', type: 'text' as const, localeKey: 'events.simulation.fields.expiryDate', default: '2026-08-23T19:55:00.000Z' },
        { name: 'topContributors', type: 'textarea' as const, localeKey: 'events.simulation.fields.topContributors', default: '[]', json: true },
        { name: 'sharedTrainParticipants', type: 'textarea' as const, localeKey: 'events.simulation.fields.sharedTrainParticipants', default: '[]', json: true },
    ]

    async handleRegister() {
        const primaryChannel = getPrimaryChannel()

        // Twitch removed/invalidated the old v1 subscription here.
        // Use EventSub channel.hype_train.begin v2.
        this.eventSubWs.onChannelHypeTrainBeginV2(primaryChannel.id, (event: any) => this.handleEvent(event))
    }

    async handle(event: any) {
        const id = String(event?.id ?? '').trim() || undefined
        const level = Number(event?.level)
        const trackedId = this.twitchClient?.getHypeTrainId()
        const trackedLevel = this.twitchClient?.getHypeTrainLevel(id)

        if (!id || !trackedId || trackedId !== id) {
            this.twitchClient?.resetHypeTrainLevel(
                Number.isFinite(level) ? level : undefined,
                id
            )
        } else if (Number.isFinite(level) && (trackedLevel === undefined || level > trackedLevel)) {
            this.twitchClient?.setHypeTrainLevel(level, id)
        }

        logRegular(
            `hype train begin${Number.isFinite(level) ? ` at level ${level}` : ``}` +
            `${trackedLevel !== undefined && trackedId === id && trackedLevel > level ? ` (keeping level ${trackedLevel})` : ``}`
        )

        if(isShieldActive()) {
            logWarn('Shield mode active!')
            return
        }

        await this.triggerConfiguredEvent(event)

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: 600_000})
    }
}
