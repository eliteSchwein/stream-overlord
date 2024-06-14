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
import {logError, logNotice, logRegular, logWarn} from "../../../helper/LogHelper";
import BoostChannelPoint from "./channel_points/BoostChannelPoint";

export default class ChannelPointsEvent extends BaseEvent{
    name = 'ChannelPointEvents'
    eventTypes = []

    protected channelPoints = []

    async register() {
        const eventSubListener = new EventSubWsListener({ apiClient: this.bot.api, logger: { minLevel: 'ERROR' } });
        eventSubListener.start();
        registerEventCooldown(this.name)

        logRegular(`register channel point handler`)

        this.channelPoints.push(new BoostChannelPoint())

        const channels = getConfig(/twitch/g)[0]['channels']

        for(const channel of channels) {
            const channelId = await this.bot.api.users.getUserByName(channel)

            eventSubListener.onChannelRedemptionAdd(channelId, async (event: EventSubChannelRedemptionAddEvent) => await this.handleEventSub(event))
        }

        const primaryChannel = await this.bot.api.users.getUserByName(channels[0])

        const presentChannelPoints = await this.bot.api.channelPoints.getCustomRewards(primaryChannel.id)
        const rewardNames = presentChannelPoints.map(reward => reward.title)

        for(const channelPoint of this.channelPoints) {
            const channelPointTitle = channelPoint.getTitle()

            if(rewardNames.includes(channelPointTitle)) continue

            logNotice(`create channel point ${channelPointTitle}`)

            await this.bot.api.channelPoints.createCustomReward(primaryChannel.id, {title: channelPointTitle, cost: 666})
        }
    }

    async handleEventSub(event: EventSubChannelRedemptionAddEvent) {
        let isValid = false

        for(const channelPoint of this.channelPoints) {
            if(channelPoint.getTitle() !== event.rewardTitle) continue

            isValid = true
            break
        }

        if(!isValid) return

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

        for(const channelPoint of this.channelPoints) {
            try {
                await channelPoint.handleChannelPoint(event)
            } catch (error) {
                if(event.broadcasterName !== event.userName) {
                    await this.bot.whisper(event.userName, 'Deine Kanalpunkte wurden dir zurück gegeben weil ein Fehler aufgetreten ist.')
                }

                logError(`channel point denied for ${event.userName} because of a exception:`)
                logError(JSON.stringify(error, Object.getOwnPropertyNames(error)))
                await event.updateStatus('CANCELED')
                return
            }
        }

        await sleep(this.eventCooldown * 1000)

        removeEventFromCooldown(eventUuid, this.name, event.broadcasterName)
    }
}