import BaseEvent from "./BaseEvent";
import {EventSubChannelFollowEvent} from "@twurple/eventsub-base";
import {getAssetConfig, getPrimaryChannel} from "../../../../helper/ConfigHelper";
import {addAlert} from "../../../../helper/AlertHelper";
import {waitUntil} from "async-wait-until";
import {isEventQueried} from "../../helper/CooldownHelper";
import {logRegular, logWarn} from "../../../../helper/LogHelper";
import isShieldActive from "../../../../helper/ShieldHelper";

export default class FollowEvent extends BaseEvent {
    name = 'Follow'
    eventTypes = []

    async handleRegister() {
        const primaryChannel = getPrimaryChannel()

        this.eventSubWs.onChannelFollow(primaryChannel, primaryChannel, (event: any) => this.handleEvent(event))
    }

    async handle(event: EventSubChannelFollowEvent) {
        const theme = getAssetConfig('follow')

        logRegular(`follow from ${event.userDisplayName}`)

        if(isShieldActive()) {
            logWarn('Shield mode active!')
            return
        }

        addAlert({
            'sound': theme.sound,
            'duration': 15,
            'color': theme.color,
            'icon': theme.icon,
            'message': `${event.userDisplayName} folgt nun`,
            'event-uuid': this.eventUuid,
            'video': theme.video,
            'lamp_color': theme.lamp_color
        })

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: 600_000})
    }
}