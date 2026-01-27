import BaseEvent from "./BaseEvent";
import {SubGiftEvent as EasyEvent} from "@twurple/easy-bot";
import {WAIT_FOREVER, waitUntil} from "async-wait-until";
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

        let plan = event.plan

        if(!isNaN(Number.parseInt(plan))) {
            plan = `${Number.parseInt(plan)/1000}`
        }

        logRegular(`sub gift from ${event.gifterDisplayName} to ${event.userDisplayName} in ${event.months} month on tier ${plan}`)

        if(isShieldActive()) {
            logWarn('Shield mode active!')
            return
        }

        addAlert({
            'sound': theme.sound,
            'duration': 15,
            'color': theme.color,
            'icon': theme.icon,
            'message': `${event.gifterDisplayName} schenkt ${event.userDisplayName} ein Abo auf Stufe ${plan}`,
            'event-uuid': this.eventUuid,
            'video': theme.video,
            'lamp_color': theme.lamp_color,
            'volume': theme.volume,
        })

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: WAIT_FOREVER})
    }
}