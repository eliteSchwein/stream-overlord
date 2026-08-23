import BaseEvent from "./BaseEvent";
import {RaidEvent as EasyEvent} from "@twurple/easy-bot/lib/events/RaidEvent";
import {WAIT_FOREVER, waitUntil} from "async-wait-until";
import {isEventQueried} from "../helper/CooldownHelper";
import {logRegular, logWarn} from "../../../helper/LogHelper";
import isShieldActive from "../../../helper/ShieldHelper";

export default class RaidEvent extends BaseEvent {
    name = 'Raid'
    eventTypes = ['onRaid']
    configName = 'event_twitch_raid'

    simulationFields = [
        {
            name: 'broadcasterId',
            type: 'text' as const,
            localeKey: 'events.simulation.fields.broadcasterId',
            default: '123456789',
            required: true,
        },
        {
            name: 'broadcasterName',
            type: 'text' as const,
            localeKey: 'events.simulation.fields.broadcasterName',
            default: 'you',
            required: true,
        },
        {
            name: 'userId',
            type: 'text' as const,
            localeKey: 'events.simulation.fields.userId',
            default: '987654321',
            required: true,
        },
        {
            name: 'userDisplayName',
            type: 'text' as const,
            localeKey: 'events.simulation.fields.userDisplayName',
            default: 'TestRaider',
            required: true,
        },
        {
            name: 'viewerCount',
            type: 'number' as const,
            localeKey: 'events.simulation.fields.viewerCount',
            default: 42,
            min: 1,
            step: 1,
            required: true,
        },
        {
            name: 'gameName',
            type: 'text' as const,
            localeKey: 'events.simulation.fields.gameName',
            default: 'Just Chatting',
        },
    ]

    async handle(event: EasyEvent) {
        logRegular(`raid from ${event.userDisplayName} with ${event.viewerCount} viewers`)

        if(isShieldActive()) {
            logWarn('Shield mode active!')
            return
        }

        let gameName = ''

        try {
            const stream = await this.bot.api.streams.getStreamByUserId(event.userId)
            gameName = stream?.gameName ?? ''
        } catch (_) {
            logWarn(`failed to fetch raid category for ${event.userDisplayName}`)
        }

        await this.triggerConfiguredEvent({
            ...this.sanitizeMacroEvent(event),
            gameName,
        })

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: WAIT_FOREVER})
    }
}
