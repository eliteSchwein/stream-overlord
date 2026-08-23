import BaseEvent from "./BaseEvent";
import {getPrimaryChannel} from "../../../../helper/ConfigHelper";
import {waitUntil} from "async-wait-until";
import {isEventQueried} from "../../helper/CooldownHelper";
import {logRegular, logWarn} from "../../../../helper/LogHelper";
import isShieldActive from "../../../../helper/ShieldHelper";

export default class PollProgressEvent extends BaseEvent {
    name = 'PollProgress'
    configName = 'event_twitch_poll_progress'
    eventTypes = []

    simulationFields = [
        { name: 'id', type: 'text' as const, localeKey: 'events.simulation.fields.pollId', default: 'poll-test', required: true },
        { name: 'title', type: 'text' as const, localeKey: 'events.simulation.fields.title', default: 'What should we play?', required: true },
        { name: 'choices', type: 'textarea' as const, localeKey: 'events.simulation.fields.choices', default: '[{"id":"choice-1","title":"Game A","bitsVotes":0,"channelPointsVotes":0,"votes":10},{"id":"choice-2","title":"Game B","bitsVotes":0,"channelPointsVotes":0,"votes":5}]', json: true, required: true },
        { name: 'isBitsVotingEnabled', type: 'boolean' as const, localeKey: 'events.simulation.fields.isBitsVotingEnabled', default: false },
        { name: 'bitsPerVote', type: 'number' as const, localeKey: 'events.simulation.fields.bitsPerVote', default: 0, min: 0, step: 1 },
        { name: 'isChannelPointsVotingEnabled', type: 'boolean' as const, localeKey: 'events.simulation.fields.isChannelPointsVotingEnabled', default: false },
        { name: 'channelPointsPerVote', type: 'number' as const, localeKey: 'events.simulation.fields.channelPointsPerVote', default: 0, min: 0, step: 1 },
        { name: 'startDate', type: 'text' as const, localeKey: 'events.simulation.fields.startDate', default: '2026-08-23T20:00:00.000Z', required: true },
        { name: 'endDate', type: 'text' as const, localeKey: 'events.simulation.fields.endDate', default: '2026-08-23T20:05:00.000Z', required: true },
    ]

    async handleRegister() {
        const primaryChannel = getPrimaryChannel()

        this.eventSubWs.onChannelPollProgress(primaryChannel, (event: any) => this.handleEvent(event))
    }

    async handle(event: any) {
        logRegular(`poll progress`)

        if(isShieldActive()) {
            logWarn('Shield mode active!')
            return
        }

        await this.triggerConfiguredEvent(event)

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: 600_000})
    }
}
