import BaseEvent from "./BaseEvent";
import {SubGiftEvent as EasyEvent} from "@twurple/easy-bot";
import {WAIT_FOREVER, waitUntil} from "async-wait-until";
import {isEventQueried} from "../helper/CooldownHelper";
import {logRegular, logWarn} from "../../../helper/LogHelper";
import isShieldActive from "../../../helper/ShieldHelper";

export default class SubGiftEvent extends BaseEvent {
    name = 'SubGift'
    eventTypes = ['onSubGift']
    configName = 'event_twitch_subgift'

    async handle(event: EasyEvent) {
        let plan = event.plan

        if(!isNaN(Number.parseInt(plan))) {
            plan = `${Number.parseInt(plan)/1000}`
        }

        logRegular(`sub gift from ${event.gifterDisplayName} to ${event.userDisplayName} in ${event.months} month on tier ${plan}`)

        if(isShieldActive()) {
            logWarn('Shield mode active!')
            return
        }

        await this.triggerConfiguredEvent(event)

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: WAIT_FOREVER})
    }
}