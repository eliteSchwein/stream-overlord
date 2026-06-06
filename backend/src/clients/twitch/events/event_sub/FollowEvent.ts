import BaseEvent from "./BaseEvent";
import {EventSubChannelFollowEvent} from "@twurple/eventsub-base";
import {getPrimaryChannel} from "../../../../helper/ConfigHelper";
import {waitUntil} from "async-wait-until";
import {isEventQueried} from "../../helper/CooldownHelper";
import {logRegular, logWarn} from "../../../../helper/LogHelper";
import isShieldActive from "../../../../helper/ShieldHelper";
import {triggerMacro} from "../../../../helper/MacroHelper";

export default class FollowEvent extends BaseEvent {
    name = 'Follow'
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

        await triggerMacro('follow', this.getMacroVariables(event))

        //addAlert({
        //    'sound': theme.sound,
        //    'duration': 15,
        //    'color': theme.color,
        //    'icon': theme.icon,
        //    'message': `${event.userDisplayName} folgt nun`,
        //    'event-uuid': this.eventUuid,
        //    'video': theme.video,
        //    'lamp_color': theme.lamp_color,
        //    'volume': theme.volume,
        //    'image': theme.image,
        //    'channel': theme.channel,
        //})

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: 600_000})
    }
}