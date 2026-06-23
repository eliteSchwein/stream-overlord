import BaseEvent from "./BaseEvent";
import {resetChannelPermissions} from "../../helper/PermissionHelper";
import {getPrimaryChannel} from "../../../../helper/ConfigHelper";

export default class ChannelSharedChatSessionEnd  extends BaseEvent {
    name = 'ChannelSharedChatSessionEnd'
    eventTypes = ['onChannelSharedChatSessionEnd']
    configName = 'event_twitch_sharedchat_end'

    async handle(event: any) {
        await resetChannelPermissions(getPrimaryChannel().name)

        await this.triggerConfiguredEvent(event)
    }
}