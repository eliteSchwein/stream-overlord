import BaseEvent from "./BaseEvent";
import {getPrimaryChannel} from "../../../../helper/ConfigHelper";
import {waitUntil} from "async-wait-until";
import {isEventQueried} from "../../helper/CooldownHelper";
import {logRegular, logWarn} from "../../../../helper/LogHelper";
import isShieldActive from "../../../../helper/ShieldHelper";

export default class ChannelHypeTrainProgressEvent extends BaseEvent {
    name = 'ChannelHypeTrainProgress'
    configName = 'event_twitch_hype_train_progress'
    eventTypes = []

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
            // A progress notification may arrive before the begin notification.
            // In that case only initialize the level; do not emit a false level-up.
            if (previousLevel === undefined) {
                this.twitchClient?.setHypeTrainLevel(level)
            } else if (level > previousLevel) {
                this.twitchClient?.setHypeTrainLevel(level)

                logRegular(`hype train level up: ${previousLevel} -> ${level}`)

                if (!isShieldActive()) {
                    await this.triggerConfiguredEvent(
                        event,
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
