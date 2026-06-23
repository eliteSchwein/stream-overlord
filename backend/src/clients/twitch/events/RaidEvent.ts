import BaseEvent from "./BaseEvent";
import {RaidEvent as EasyEvent} from "@twurple/easy-bot/lib/events/RaidEvent";
import {WAIT_FOREVER, waitUntil} from "async-wait-until";
import {isEventQueried} from "../helper/CooldownHelper";
import {logRegular, logWarn} from "../../../helper/LogHelper";
import isShieldActive from "../../../helper/ShieldHelper";
import {triggerMacro} from "../../../helper/MacroHelper";

export default class RaidEvent extends BaseEvent {
    name = 'Raid'
    eventTypes = ['onRaid']
    configName = 'event_twitch_raid'

    async handle(event: EasyEvent) {

        logRegular(`raid from ${event.userDisplayName} with ${event.viewerCount} viewers`)

        if(isShieldActive()) {
            logWarn('Shield mode active!')
            return
        }

        await triggerMacro('raid', this.getMacroVariables(event))

        await waitUntil(() => !isEventQueried(this.eventUuid), {timeout: WAIT_FOREVER})
    }
}