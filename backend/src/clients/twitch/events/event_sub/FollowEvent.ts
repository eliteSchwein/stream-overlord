import BaseEvent from "./BaseEvent";
import {EventSubChannelFollowEvent} from "@twurple/eventsub-base";
import {getPrimaryChannel} from "../../../../helper/ConfigHelper";
import {waitUntil} from "async-wait-until";
import {isEventQueried} from "../../helper/CooldownHelper";
import {logRegular, logWarn} from "../../../../helper/LogHelper";
import isShieldActive from "../../../../helper/ShieldHelper";

export default class FollowEvent extends BaseEvent {
    name = 'Follow'
    configName = "event_twitch_follow"
    eventTypes = []

    async handleRegister() {
        const primaryChannel = getPrimaryChannel()

        this.eventSubWs.onChannelFollow(primaryChannel, primaryChannel, (event: any) => this.handleEvent(event))
    }

    async handle(event: EventSubChannelFollowEvent) {
        logRegular(`follow from ${event.userDisplayName}`)

        if(isShieldActive()) {
            logWarn('Shield mode active!')
            return
        }

        await this.triggerConfiguredEvent(event)

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: 600_000})
    }
}