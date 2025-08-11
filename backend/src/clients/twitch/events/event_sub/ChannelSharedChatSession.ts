
import BaseEvent from "./BaseEvent";
import registerPermissions, {addModeratorsToChannelFromExternal} from "../../helper/PermissionHelper";
import {logWarn} from "../../../../helper/LogHelper";
import {getPrimaryChannel} from "../../../../helper/ConfigHelper";

export default class ChannelSharedChatSession  extends BaseEvent {
    name = 'ChannelSharedChatSession'
    eventTypes = ['onChannelSharedChatSessionBegin', 'onChannelSharedChatSessionUpdate']

    async handle(event: any) {
        const participants = event.participants

        if(!participants) {
            logWarn("no participants found in shared chat session")
            return
        }

        const primaryChannel = getPrimaryChannel().name

        for(const participant of participants) {
            await addModeratorsToChannelFromExternal(primaryChannel, participant.broadcasterName)
        }
    }
}