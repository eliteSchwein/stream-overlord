import BaseEvent from "./BaseEvent";
import {
    EventSubChannelPollBeginEvent,
    EventSubChannelPollEndEvent,
    EventSubChannelPredictionBeginEvent,
    EventSubChannelPredictionEndEvent
} from "@twurple/eventsub-base";
import type {EventSimulationField} from "../../../../helper/EventHelper";
import {setVariable} from "../../../../helper/VariableHelper";

export default class PollPredictionEvent extends BaseEvent {
    name = 'PollPredictionEvent'
    eventTypes = ['onChannelPollBegin', 'onChannelPollEnd', 'onChannelPredictionBegin', 'onChannelPredictionEnd']

    private pollBeginSimulationFields: EventSimulationField[] = [
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

    private pollEndSimulationFields: EventSimulationField[] = [
        ...this.pollBeginSimulationFields,
        { name: 'status', type: 'text' as const, localeKey: 'events.simulation.fields.status', default: 'completed', required: true },
    ]

    private predictionBeginSimulationFields: EventSimulationField[] = [
        { name: 'id', type: 'text' as const, localeKey: 'events.simulation.fields.predictionId', default: 'prediction-test', required: true },
        { name: 'title', type: 'text' as const, localeKey: 'events.simulation.fields.title', default: 'Will we win?', required: true },
        { name: 'outcomes', type: 'textarea' as const, localeKey: 'events.simulation.fields.outcomes', default: '[{"id":"outcome-1","title":"Yes","color":"blue","users":10,"channelPoints":5000,"topPredictors":[]},{"id":"outcome-2","title":"No","color":"pink","users":5,"channelPoints":2500,"topPredictors":[]}]', json: true, required: true },
        { name: 'startDate', type: 'text' as const, localeKey: 'events.simulation.fields.startDate', default: '2026-08-23T20:00:00.000Z', required: true },
        { name: 'lockDate', type: 'text' as const, localeKey: 'events.simulation.fields.lockDate', default: '2026-08-23T20:02:00.000Z', required: true },
    ]

    private predictionEndSimulationFields: EventSimulationField[] = [
        { name: 'id', type: 'text' as const, localeKey: 'events.simulation.fields.predictionId', default: 'prediction-test', required: true },
        { name: 'title', type: 'text' as const, localeKey: 'events.simulation.fields.title', default: 'Will we win?', required: true },
        { name: 'outcomes', type: 'textarea' as const, localeKey: 'events.simulation.fields.outcomes', default: '[{"id":"outcome-1","title":"Yes","color":"blue","users":10,"channelPoints":5000,"topPredictors":[]},{"id":"outcome-2","title":"No","color":"pink","users":5,"channelPoints":2500,"topPredictors":[]}]', json: true, required: true },
        { name: 'startDate', type: 'text' as const, localeKey: 'events.simulation.fields.startDate', default: '2026-08-23T20:00:00.000Z', required: true },
        { name: 'endDate', type: 'text' as const, localeKey: 'events.simulation.fields.endDate', default: '2026-08-23T20:10:00.000Z', required: true },
        { name: 'status', type: 'text' as const, localeKey: 'events.simulation.fields.status', default: 'resolved', required: true },
        { name: 'winningOutcomeId', type: 'text' as const, localeKey: 'events.simulation.fields.winningOutcomeId', default: 'outcome-1' },
        { name: 'winningOutcome', type: 'textarea' as const, localeKey: 'events.simulation.fields.winningOutcome', default: '{"id":"outcome-1","title":"Yes","color":"blue","users":10,"channelPoints":5000,"topPredictors":[]}', json: true },
    ]

    protected getSimulationFields(configName: string): EventSimulationField[] {
        switch (configName) {
            case 'event_twitch_poll_begin':
                return this.pollBeginSimulationFields
            case 'event_twitch_poll_completed':
            case 'event_twitch_poll_terminated':
                return this.pollEndSimulationFields
            case 'event_twitch_prediction_completed':
                return this.predictionBeginSimulationFields
            case 'event_twitch_prediction_resolved':
            case 'event_twitch_prediction_canceled':
            case 'event_twitch_prediction_finished':
                return this.predictionEndSimulationFields
            default:
                return []
        }
    }

    private getHighestChoice(choices: any[] | null | undefined) {
        if (!choices?.length) {
            return { choice: null, isTie: false };
        }

        let highestChoice: any | null = null;
        let highestVotes = -1;
        let isTie = false;

        for (const choice of choices) {
            const votes = choice?.votes ?? 0;

            if (votes > highestVotes) {
                highestVotes = votes;
                highestChoice = choice;
                isTie = false;
            } else if (votes === highestVotes) {
                isTie = true;
            }
        }

        return { choice: highestChoice, isTie };
    }

    private sanitizeEvent(value: any, seen = new WeakSet<object>()): any {
        if (value === null || value === undefined) return value;

        if (
            typeof value === "string"
            || typeof value === "number"
            || typeof value === "boolean"
        ) {
            return value;
        }

        if (value instanceof Date) {
            return value.toISOString();
        }

        if (Array.isArray(value)) {
            return value.map((entry) => this.sanitizeEvent(entry, seen));
        }

        if (typeof value === "object") {
            if (seen.has(value)) return undefined;
            seen.add(value);

            const result: Record<string, any> = {};

            for (const [key, entry] of Object.entries(value)) {
                if (typeof entry === "function" || entry === undefined) continue;

                const sanitized = this.sanitizeEvent(entry, seen);
                if (sanitized !== undefined) {
                    result[key] = sanitized;
                }
            }

            return result;
        }

        return String(value);
    }

    async handleRegister() {
        for (const configName of [
            "event_twitch_poll_begin",
            "event_twitch_poll_completed",
            "event_twitch_poll_terminated",
            "event_twitch_prediction_completed",
            "event_twitch_prediction_resolved",
            "event_twitch_prediction_canceled",
            "event_twitch_prediction_finished"
        ]) {
            this.registerConfigEvent(configName)
        }
    }

    async handle(event: any) {
        const channel = event?.broadcasterName;

        if (!channel) {
            return;
        }

        if (event instanceof EventSubChannelPollBeginEvent) {
            await setVariable("twitch_poll", this.sanitizeEvent(event), false);
            await this.triggerConfiguredEvent(event, "event_twitch_poll_begin")
            return;
        }

        if (event instanceof EventSubChannelPollEndEvent) {
            switch (event.status) {
                case "completed": {
                    const { choice: highestChoice, isTie } = this.getHighestChoice(event.choices);

                    await this.triggerConfiguredEvent(event, "event_twitch_poll_completed")
                    return;

                    if (isTie) {
                        await this.bot.say(channel, `Die Umfrage "${event.title}" wurde mit einem Unentschieden beendet.`);
                        return;
                    }

                    if (!highestChoice?.title) {
                        await this.bot.say(channel, `Die Umfrage "${event.title}" wurde beendet.`);
                        return;
                    }

                    await this.bot.say(channel, `Die Umfrage "${event.title}" wurde beendet, gewonnen hat: ${highestChoice.title}`);
                    return;
                }
                case "archived":
                case "terminated":
                    await this.triggerConfiguredEvent(event, "event_twitch_poll_terminated")
                    // await this.bot.say(channel, `Die Umfrage "${event.title}" wurde beendet.`);
                    return;
            }

            return;
        }

        if (event instanceof EventSubChannelPredictionBeginEvent) {
            await setVariable("twitch_prediction", this.sanitizeEvent(event), false);
            await this.triggerConfiguredEvent(event, "event_twitch_prediction_completed")
            // await this.bot.say(channel, `Es ist eine Vorhersage "${event.title}" aktiv, wenn ihr diese nicht sieht bitte die Seite neuladen.`);
            return;
        }

        if (event instanceof EventSubChannelPredictionEndEvent) {
            const winningOutcome = event.winningOutcome ?? null;

            switch (event.status) {
                case "resolved":
                    await this.triggerConfiguredEvent(event, "event_twitch_prediction_resolved")
                    return;
                    if (winningOutcome?.title) {
                        await this.bot.say(channel, `Die Vorhersage "${event.title}" wurde beendet, gewonnen hat: ${winningOutcome.title}`);
                        return;
                    }

                    await this.bot.say(channel, `Die Vorhersage "${event.title}" wurde beendet.`);
                    return;
                case "canceled":
                    await this.triggerConfiguredEvent(event, "event_twitch_prediction_canceled")
                    // await this.bot.say(channel, `Die Vorhersage "${event.title}" wurde abgebrochen.`);
                    return;
                default:
                    await this.triggerConfiguredEvent(event, "event_twitch_prediction_finished")
                    // await this.bot.say(channel, `Die Vorhersage "${event.title}" wurde beendet.`);
                    return;
            }
        }
    }
}
