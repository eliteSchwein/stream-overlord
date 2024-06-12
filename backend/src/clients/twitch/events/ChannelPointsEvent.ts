import {EventSubChannelRedemptionAddEvent} from "@twurple/eventsub-base"
import BaseEvent from "./BaseEvent";
import {EventSubWsListener} from "@twurple/eventsub-ws";
import {getConfig} from "../../../helper/ConfigHelper";
import registerEventCooldown, {
    addEventToCooldown,
    isEventFull,
    removeEventFromCooldown, sleep
} from "../helper/CooldownHelper";
import {v4 as uuidv4} from "uuid";
import {logWarn} from "../../../helper/LogHelper";

export default class ChannelPointsEvent extends BaseEvent{
    name = 'ChannelPointEvents'
    eventTypes = []

    protected channelPoints = [
        'test'
    ]

    async register() {
        const eventSubListener = new EventSubWsListener({ apiClient: this.bot.api, logger: { minLevel: 'ERROR' } });
        eventSubListener.start();
        registerEventCooldown(this.name)

        const channels = getConfig(/twitch/g)[0]['channels']

        for(const channel of channels) {
            const channelId = await this.bot.api.users.getUserByName(channel)

            eventSubListener.onChannelRedemptionAdd(channelId, async (event: EventSubChannelRedemptionAddEvent) => await this.handleEventSub(event))
        }

        const primaryChannel = await this.bot.api.users.getUserByName(channels[0])

        const presentChannelPoints = await this.bot.api.channelPoints.getCustomRewards(primaryChannel.id)
        const rewardNames = presentChannelPoints.map(reward => reward.title)

        for(const channelPoint of this.channelPoints) {
            if(rewardNames.includes(channelPoint)) continue

            await this.bot.api.channelPoints.createCustomReward(primaryChannel.id, {title: channelPoint, cost: 666})
        }
    }

    async handleEventSub(event: EventSubChannelRedemptionAddEvent) {
        if(!this.channelPoints.includes(event.rewardTitle)) return

        if(isEventFull(this.name, event.broadcasterName, this.eventLimit)) {
            if(event.broadcasterName !== event.userName) {
                await this.bot.whisper(event.userName, 'Deine Kanalpunkte wurden dir zurück gegeben weil aktuell die Punkte Warteschlange voll ist.')
            }

            logWarn(`channel point denied for ${event.userName} because global spam protection is active!`)
            await event.updateStatus('CANCELED')
            return
        }

        const eventUuid = uuidv4()

        addEventToCooldown(eventUuid, this.name, event.broadcasterName)

        // here channel point events

        await sleep(this.eventCooldown * 1000)

        removeEventFromCooldown(eventUuid, this.name, event.broadcasterName)
    }
}