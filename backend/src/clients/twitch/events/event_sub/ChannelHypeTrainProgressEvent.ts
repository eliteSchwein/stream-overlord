import BaseEvent from "./BaseEvent";
import {getPrimaryChannel} from "../../../../helper/ConfigHelper";
import {waitUntil} from "async-wait-until";
import {isEventQueried} from "../../helper/CooldownHelper";
import {logRegular, logWarn} from "../../../../helper/LogHelper";
import isShieldActive from "../../../../helper/ShieldHelper";
import type {EventSimulationField} from "../../../../helper/EventHelper";

export default class ChannelHypeTrainProgressEvent extends BaseEvent {
    name = 'ChannelHypeTrainProgress'
    configName = 'event_twitch_hype_train_progress'
    eventTypes = []

    simulationFields = [
        { name: 'id', type: 'text' as const, localeKey: 'events.simulation.fields.hypeTrainId', default: 'test-hype-train' },
        { name: 'type', type: 'text' as const, localeKey: 'events.simulation.fields.hypeTrainType', default: 'regular' },
        { name: 'level', type: 'number' as const, localeKey: 'events.simulation.fields.level', default: 2, min: 1, step: 1 },
        { name: 'progress', type: 'number' as const, localeKey: 'events.simulation.fields.progress', default: 50, min: 0, step: 1 },
        { name: 'goal', type: 'number' as const, localeKey: 'events.simulation.fields.goal', default: 100, min: 0, step: 1 },
        { name: 'total', type: 'number' as const, localeKey: 'events.simulation.fields.total', default: 250, min: 0, step: 1 },
        { name: 'isSharedTrain', type: 'boolean' as const, localeKey: 'events.simulation.fields.isSharedTrain', default: false },
        { name: 'startDate', type: 'text' as const, localeKey: 'events.simulation.fields.startDate', default: '2026-08-23T19:50:00.000Z' },
        { name: 'expiryDate', type: 'text' as const, localeKey: 'events.simulation.fields.expiryDate', default: '2026-08-23T19:55:00.000Z' },
        { name: 'topContributors', type: 'textarea' as const, localeKey: 'events.simulation.fields.topContributors', default: '[]', json: true },
        { name: 'sharedTrainParticipants', type: 'textarea' as const, localeKey: 'events.simulation.fields.sharedTrainParticipants', default: '[]', json: true },
    ]

    private levelUpSimulationFields: EventSimulationField[] = [
        { name: 'id', type: 'text' as const, localeKey: 'events.simulation.fields.hypeTrainId', default: 'test-hype-train' },
        { name: 'type', type: 'text' as const, localeKey: 'events.simulation.fields.hypeTrainType', default: 'regular' },
        { name: 'previousLevel', type: 'number' as const, localeKey: 'events.simulation.fields.previousLevel', default: 1, min: 1, step: 1 },
        { name: 'level', type: 'number' as const, localeKey: 'events.simulation.fields.level', default: 2, min: 1, step: 1 },
        { name: 'progress', type: 'number' as const, localeKey: 'events.simulation.fields.progress', default: 0, min: 0, step: 1 },
        { name: 'goal', type: 'number' as const, localeKey: 'events.simulation.fields.goal', default: 200, min: 0, step: 1 },
        { name: 'total', type: 'number' as const, localeKey: 'events.simulation.fields.total', default: 200, min: 0, step: 1 },
        { name: 'isSharedTrain', type: 'boolean' as const, localeKey: 'events.simulation.fields.isSharedTrain', default: false },
        { name: 'startDate', type: 'text' as const, localeKey: 'events.simulation.fields.startDate', default: '2026-08-23T19:50:00.000Z' },
        { name: 'expiryDate', type: 'text' as const, localeKey: 'events.simulation.fields.expiryDate', default: '2026-08-23T19:57:00.000Z' },
        { name: 'topContributors', type: 'textarea' as const, localeKey: 'events.simulation.fields.topContributors', default: '[]', json: true },
        { name: 'sharedTrainParticipants', type: 'textarea' as const, localeKey: 'events.simulation.fields.sharedTrainParticipants', default: '[]', json: true },
    ]

    protected getSimulationFields(configName: string): EventSimulationField[] {
        if (configName === 'event_twitch_hype_train_level_up') {
            return this.levelUpSimulationFields;
        }

        return this.simulationFields;
    }

    async handleRegister() {
        const primaryChannel = getPrimaryChannel()

        this.registerConfigEvent('event_twitch_hype_train_level_up')

        // Twitch removed/invalidated the old v1 subscription here.
        // Use EventSub channel.hype_train.progress v2.
        this.eventSubWs.onChannelHypeTrainProgressV2(primaryChannel.id, (event: any) => this.handleEvent(event))
    }

    async handle(event: any) {
        const level = Number(event?.level)
        const previousLevel = this.twitchClient?.getHypeTrainLevel()

        logRegular(
            `hype train progress${
                Number.isFinite(level)
                    ? ` level=${level}${previousLevel !== undefined ? ` previous=${previousLevel}` : ``}`
                    : ``
            }`
        )

        if (Number.isFinite(level)) {
            if (previousLevel === undefined) {
                this.twitchClient?.setHypeTrainLevel(level)
            } else if (level > previousLevel) {
                this.twitchClient?.setHypeTrainLevel(level)

                logRegular(`hype train level up: ${previousLevel} -> ${level}`)

                if (!isShieldActive()) {
                    await this.triggerConfiguredEvent(
                        {
                            ...this.sanitizeMacroEvent(event),
                            previousLevel,
                        },
                        'event_twitch_hype_train_level_up'
                    )
                }
            } else if (level !== previousLevel) {
                this.twitchClient?.setHypeTrainLevel(level)
            }
        }

        if(isShieldActive()) {
            logWarn('Shield mode active!')
            return
        }

        await this.triggerConfiguredEvent(event)

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: 600_000})
    }
}
