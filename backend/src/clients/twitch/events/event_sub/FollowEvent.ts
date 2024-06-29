import BaseEvent from "./BaseEvent";
import {EventSubChannelFollowEvent} from "@twurple/eventsub-base";
import {getAssetConfig, getConfig} from "../../../../helper/ConfigHelper";
import {addAlert} from "../../../../helper/AlertHelper";
import {waitUntil} from "async-wait-until";
import {isEventQueried} from "../../helper/CooldownHelper";
import {logRegular} from "../../../../helper/LogHelper";

export default class FollowEvent extends BaseEvent {
    name = 'Follow'
    eventTypes = []

    async handleRegister() {
        const primaryChannel = await this.bot.api.users.getUserByName(
            getConfig(/twitch/g)[0]['channels'][0])

        this.eventSubWs.onChannelFollow(primaryChannel, primaryChannel, (event: any) => this.handleEvent(event))
    }

    async handle(event: EventSubChannelFollowEvent) {
        const theme = getAssetConfig('follow')

        logRegular(`follow from ${event.userDisplayName}`)

        addAlert({
            'sound': theme.sound,
            'duration': 15,
            'color': theme.color,
            'icon': theme.icon,
            'message': `${event.userDisplayName} folgt nun`,
            'event-uuid': this.eventUuid,
            'video': theme.video
        })

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: 30_000})
    }
}