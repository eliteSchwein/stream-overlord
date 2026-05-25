import BaseEvent from "./BaseEvent"
import {EventSubChannelChatMessageDeleteEvent} from "@twurple/eventsub-base"
import {logRegular} from "../../../../helper/LogHelper"
import {getPrimaryChannel} from "../../../../helper/ConfigHelper"
import {getEventUuidByMessageId, unlinkMessage} from "../../../../helper/MessageEventLinkHelper"
import {cancelMacroEvent} from "../../../../helper/MacroHelper"
import {removeAlertByEventUuid} from "../../../../helper/AlertHelper"
import {removeEventFromQuery} from "../../helper/CooldownHelper"
import {interruptSpeechByEventUuid} from "../../../../helper/TTShelper";

export default class MessageDeleteEvent extends BaseEvent {
    name = "MessageDelete"

    async register() {
        const primaryChannel = getPrimaryChannel()

        logRegular(`register eventsub event: ${this.name}`)

        this.eventSubWs.onChannelChatMessageDelete(
            primaryChannel.id,
            primaryChannel.id,
            (event: EventSubChannelChatMessageDeleteEvent) => this.handle(event),
        )
    }

    async handle(event: EventSubChannelChatMessageDeleteEvent) {
        const eventUuid = getEventUuidByMessageId(event.messageId)

        if (!eventUuid) return

        logRegular(`message deleted, cancel event: ${eventUuid}`)

        cancelMacroEvent(eventUuid)
        removeAlertByEventUuid(eventUuid)
        interruptSpeechByEventUuid(eventUuid)
        removeEventFromQuery(eventUuid)
        unlinkMessage(event.messageId)
    }
}