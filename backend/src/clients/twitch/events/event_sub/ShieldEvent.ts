import BaseEvent from "./BaseEvent";
import {getConfig, getPrimaryChannel} from "../../../../helper/ConfigHelper";
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
        if(event.constructor.name.includes('EventSubChannelShieldModeBeginEvent')) {
            void enableShield()
        }
        if(event.constructor.name.includes('EventSubChannelShieldModeEndEvent')) {
            void disableShield()
        }
    }
}