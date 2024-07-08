import BaseEvent from "./BaseEvent";
import {EventSubChannelRedemptionAddEvent} from "@twurple/eventsub-base";
import {logError, logNotice, logWarn} from "../../../../helper/LogHelper";
import {getConfig} from "../../../../helper/ConfigHelper";
import BoostChannelPoint from "../channel_points/BoostChannelPoint";
import {addEventToCooldown, isEventFull, removeEventFromCooldown} from "../../helper/CooldownHelper";
import {v4 as uuidv4} from "uuid";
import {sleep} from "../../../../../../helper/GeneralHelper";
import {addAlert} from "../../../../helper/AlertHelper";

export default class ChannelPointsEvent extends BaseEvent {
    name = 'ChannelPointsEvent'
    eventTypes = ['onChannelRedemptionAdd']

    protected channelPoints = []

    async handleRegister() {
        const primaryChannel = await this.bot.api.users.getUserByName(
            getConfig(/twitch/g)[0]['channels'][0])

        this.channelPoints.push(new BoostChannelPoint(this.eventSubWs, this.bot))

        const presentChannelPoints = await this.bot.api.channelPoints.getCustomRewards(primaryChannel.id)
        const rewardNames = presentChannelPoints.map(reward => reward.title)
        const soundAlerts = getConfig(/soundalert /g)


        for(const channelPoint of this.channelPoints) {
            const channelPointTitle = channelPoint.getTitle()

            if(rewardNames.includes(channelPointTitle)) continue

            logNotice(`create channel point: ${channelPointTitle}`)

            await this.bot.api.channelPoints.createCustomReward(primaryChannel.id, {title: channelPointTitle, cost: 666})
        }

        for(const soundAlert of soundAlerts) {
            if(rewardNames.includes(soundAlert.point_label)) continue

            logNotice(`create channel point alert: ${soundAlert.point_label}`)

            await this.bot.api.channelPoints.createCustomReward(primaryChannel.id, {title: soundAlert.point_label, cost: 69})
        }
    }

    async handle(event: EventSubChannelRedemptionAddEvent) {
        let isValid = false
        const soundAlerts = getConfig(/soundalert /g)

        for(const soundAlert of soundAlerts) {
            if(soundAlert.point_label !== event.rewardTitle) continue

            addAlert({
                'sound': soundAlert.sound,
                'duration': soundAlert.duration,
                'icon': (soundAlert.icon) ? soundAlert.icon : '',
                'message': (soundAlert.message) ? soundAlert.message : '',
                'event-uuid': `alert-${soundAlert.point_label}`,
                'video': (soundAlert.video) ? soundAlert.video : ''
            })

            if(soundAlert.auto_accept) {
                await event.updateStatus('FULFILLED')
            }

            return
        }

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