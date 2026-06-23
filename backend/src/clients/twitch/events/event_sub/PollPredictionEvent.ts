import BaseEvent from "./BaseEvent";
import {
    EventSubChannelPollBeginEvent,
    EventSubChannelPollEndEvent,
    EventSubChannelPredictionBeginEvent,
    EventSubChannelPredictionEndEvent
} from "@twurple/eventsub-base";
import {registerEventEntries} from "../../../../helper/EventHelper";

export default class PollPredictionEvent extends BaseEvent {
    name = 'PollPredictionEvent'
    eventTypes = ['onChannelPollBegin', 'onChannelPollEnd', 'onChannelPredictionBegin', 'onChannelPredictionEnd']

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

    async handleRegister() {
        registerEventEntries([
            "event_twitch_poll_begin",
            "event_twitch_poll_completed",
            "event_twitch_poll_terminated",
            "event_twitch_prediction_completed",
            "event_twitch_prediction_resolved",
            "event_twitch_prediction_canceled",
            "event_twitch_prediction_finished"
        ])
    }

    async handle(event: any) {
        const channel = event?.broadcasterName;

        if (!channel) {
            return;
        }

        if (event instanceof EventSubChannelPollBeginEvent) {
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
