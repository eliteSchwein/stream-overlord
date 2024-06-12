import {Bot} from "@twurple/easy-bot";
import {EventSubChannelRedemptionAddEvent} from "@twurple/eventsub-base"
import BaseEvent from "./BaseEvent";
import {EventSubWsListener} from "@twurple/eventsub-ws";
import {getConfig} from "../../../helper/ConfigHelper";
import registerEventCooldown, {isEventFull} from "../helper/CooldownHelper";

export default class ChannelPointsEvent extends BaseEvent{
    name = 'ChannelPointEvents'
    eventTypes = []
    eventLimit: 5

    async register() {
        const eventSubListener = new EventSubWsListener({ apiClient: this.bot.api, logger: { minLevel: 'ERROR' } });
        eventSubListener.start();
        registerEventCooldown(this.name)

        const channels = getConfig(/twitch/g)[0]['channels']

        for(const channel of channels) {
            const channelId = await this.bot.api.users.getUserByName(channel)

            eventSubListener.onChannelRedemptionAdd(channelId, async (event: EventSubChannelRedemptionAddEvent) => await this.handleEventSub(event))
        }
    }

    async handleEventSub(event: EventSubChannelRedemptionAddEvent) {
        if(isEventFull(this.name, event.broadcasterName, this.eventLimit)) {
            // todo: auto deny channel point if cooldown active
            return
        }


        console.log(event.rewardTitle)
        console.log(event.input)
    }
}