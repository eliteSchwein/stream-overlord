import BaseEvent from "./BaseEvent";
import {SubGiftEvent as EasyEvent} from "@twurple/easy-bot";
import {waitUntil} from "async-wait-until";
import {isEventQueried} from "../helper/CooldownHelper";
import {getAssetConfig} from "../../../helper/ConfigHelper";
import {addAlert} from "../../../helper/AlertHelper";
import {logRegular, logWarn} from "../../../helper/LogHelper";
import isShieldActive from "../../../helper/ShieldHelper";

export default class SubGiftEvent extends BaseEvent {
    name = 'SubGift'
    eventTypes = ['onSubGift']

    async handle(event: EasyEvent) {
        const theme = getAssetConfig('sub')

        logRegular(`sub gift from ${event.gifterDisplayName} to ${event.userDisplayName} in ${event.months} month on tier ${event.plan}`)

        if(isShieldActive()) {
            logWarn('Shield mode active!')
            return
        }

        addAlert({
            'sound': theme.sound,
            'duration': 15,
            'color': theme.color,
            'icon': theme.icon,
            'message': `${event.gifterDisplayName} schenkt ${event.userDisplayName} ein Abo auf Stufe ${event.plan}`,
            'event-uuid': this.eventUuid,
            'video': theme.video,
            'lamp_color': theme.lamp_color
        })

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: 30_000})
    }
}