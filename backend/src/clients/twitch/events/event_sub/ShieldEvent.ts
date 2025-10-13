import BaseEvent from "./BaseEvent";
import {EventSubChannelShieldModeBeginEvent, EventSubChannelShieldModeEndEvent} from "@twurple/eventsub-base";
import {getPrimaryChannel} from "../../../../helper/ConfigHelper";
import {disableShield, enableShield} from "../../../../helper/ShieldHelper";

export default class ShieldEvent extends BaseEvent {
    name = 'Shield'
    eventTypes = []

    async handleRegister() {
        const primaryChannel = getPrimaryChannel()

        this.eventSubWs.onChannelShieldModeBegin(primaryChannel, primaryChannel, (event: any) => this.handle(event))
        this.eventSubWs.onChannelShieldModeEnd(primaryChannel, primaryChannel, (event: any) => this.handle(event))
    }

    async handle(event: any) {
        if(event instanceof EventSubChannelShieldModeBeginEvent) {
            void enableShield()
        }
        if(event instanceof EventSubChannelShieldModeEndEvent) {
            void disableShield()
        }
    }
}