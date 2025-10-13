import BaseEvent from "./BaseEvent";
import {
    EventSubChannelPollBeginEvent,
    EventSubChannelPollEndEvent,
    EventSubChannelPredictionBeginEvent,
    EventSubChannelPredictionEndEvent
} from "@twurple/eventsub-base";

export default class PollPredictionEvent extends BaseEvent {
    name = 'PollPredictionEvent'
    eventTypes = ['onChannelPollBegin', 'onChannelPollEnd', 'onChannelPredictionBegin', 'onChannelPredictionEnd']

    async handle(event: any) {
        const channel = event.broadcasterName
        if(event instanceof EventSubChannelPollBeginEvent) {
            await this.bot.say(channel, `Es ist eine Umfrage "${event.title}" aktiv, wenn ihr diese nicht sieht bitte die Seite neuladen.`)
        }
        if(event instanceof EventSubChannelPollEndEvent) {
            switch (event.status) {
                case "completed":
                    const results = event.choices

                    let highestChoice = null;
                    let isTie = false;
                    let highestVotes = -1;

                    for (const choice of results) {
                        if (choice.votes > highestVotes) {
                            highestVotes = choice.votes;
                            highestChoice = choice;
                            isTie = false; // reset tie flag
                        } else if (choice.votes === highestVotes) {
                            isTie = true; // we found another choice with same top votes
                        }
                    }

                    if(isTie) {
                        await this.bot.say(channel, `Die Umfrage "${event.title}" wurde mit einen unentschieden beendet.`)
                        return;
                    }
                    await this.bot.say(channel, `Die Umfrage "${event.title}" wurde beendet, gewonnen hat: ${highestChoice.title}`)
                    return;
                case "archived":
                case "terminated":
                    await this.bot.say(channel, `Die Umfrage "${event.title}" wurde beendet.`)
                    return;
            }
        }
        if(event instanceof EventSubChannelPredictionBeginEvent) {
            await this.bot.say(channel, `Es ist eine Vorhersage "${event.title}" aktiv, wenn ihr diese nicht sieht bitte die Seite neuladen.`)
        }
        if(event instanceof EventSubChannelPredictionEndEvent) {
            console.log(event)
        }
    }
}