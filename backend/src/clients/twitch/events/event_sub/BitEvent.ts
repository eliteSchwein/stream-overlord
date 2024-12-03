import BaseEvent from "./BaseEvent";
import {EventSubChannelCheerEvent} from "@twurple/eventsub-base";
import {getAssetConfig} from "../../../../helper/ConfigHelper";
import {waitUntil} from "async-wait-until";
import {isEventQueried} from "../../helper/CooldownHelper";
import {addAlert} from "../../../../helper/AlertHelper";
import {logRegular, logWarn} from "../../../../helper/LogHelper";
import isShieldActive from "../../../../helper/ShieldHelper";

export default class BitEvent extends BaseEvent {
    name = 'Bits'
    eventTypes = ['onChannelCheer']


    async handle(event: EventSubChannelCheerEvent) {
        const theme = getAssetConfig('bits')

        logRegular(`${event.bits} bits from ${event.userDisplayName}`)

        if(isShieldActive()) {
            logWarn('Shield mode active!')
            return
        }

        addAlert({
            'sound': theme.sound,
            'duration': 15,
            'color': theme.color,
            'icon': theme.icon,
            'message': `${event.userDisplayName} haut ${event.bits} Bits raus`,
            'event-uuid': this.eventUuid,
            'video': theme.video,
            'lamp_color': theme.lamp_color
        })

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: 30_000})
    }
}