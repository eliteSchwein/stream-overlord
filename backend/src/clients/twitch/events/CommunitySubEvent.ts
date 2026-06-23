import BaseEvent from "./BaseEvent";
import {CommunitySubEvent as EasyEvent} from "@twurple/easy-bot";
import {WAIT_FOREVER, waitUntil} from "async-wait-until";
import {isEventQueried} from "../helper/CooldownHelper";
import {logRegular, logWarn} from "../../../helper/LogHelper";
import isShieldActive from "../../../helper/ShieldHelper";

export default class CommunitySubEvent extends BaseEvent {
    name = 'CommunitySub'
    eventTypes = ['onCommunitySub']
    configName = 'event_twitch_community_sub'

    async handle(event: EasyEvent) {
        let plan = event.plan

        if(!isNaN(Number.parseInt(plan))) {
            plan = `${Number.parseInt(plan)/1000}`
        }

        logRegular(`${event.count} subs gifted from ${event.gifterDisplayName} on tier ${plan}`)

        if(isShieldActive()) {
            logWarn('Shield mode active!')
            return
        }

        await this.triggerConfiguredEvent(event)

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: WAIT_FOREVER})
    }
}