import BaseEvent from "./BaseEvent";
import type {EventSubChannelChatMessageDeleteEvent} from "@twurple/eventsub-base";
import {logRegular} from "../../../../helper/LogHelper";
import {getPrimaryChannel} from "../../../../helper/ConfigHelper";
import {getEventUuidByMessageId, unlinkMessage} from "../../../../helper/MessageEventLinkHelper";
import {cancelMacroEvent} from "../../../../helper/MacroHelper";
import {removeAlertByEventUuid} from "../../../../helper/AlertHelper";
import {removeEventFromQuery} from "../../helper/CooldownHelper";
import {interruptSpeechByEventUuid} from "../../../../helper/TTShelper";
import {cancelInteraction} from "../../../../helper/InteractionHelper";

export default class MessageDeleteEvent extends BaseEvent {
    name = "MessageDelete";
    configName = "event_twitch_message_delete";
    eventTypes = [];
    eventLimit = 50;
    eventCooldown = 0;

    simulationFields = [
        { name: "messageId", type: "text" as const, localeKey: "events.simulation.fields.messageId", default: "00000000-0000-0000-0000-000000000001", required: true },
        { name: "userId", type: "text" as const, localeKey: "events.simulation.fields.userId", default: "987654321", required: true },
        { name: "userName", type: "text" as const, localeKey: "events.simulation.fields.userName", default: "testviewer", required: true },
        { name: "userDisplayName", type: "text" as const, localeKey: "events.simulation.fields.userDisplayName", default: "TestViewer", required: true },
    ];

    async handleRegister() {
        const primaryChannel = getPrimaryChannel();

        this.eventSubWs.onChannelChatMessageDelete(
            primaryChannel.id,
            primaryChannel.id,
            (event: EventSubChannelChatMessageDeleteEvent) => this.handleEvent(event),
        );
    }

    async handle(event: EventSubChannelChatMessageDeleteEvent) {
        const payload = {
            messageId: event.messageId,
            userId: event.userId,
            userName: event.userName,
            userDisplayName: event.userDisplayName,
            broadcasterId: event.broadcasterId,
            broadcasterName: event.broadcasterName,
            broadcasterDisplayName: event.broadcasterDisplayName,
        };

        logRegular(`chat message deleted from ${event.userDisplayName || event.userName || event.userId}: ${event.messageId}`);

        // A deleted chat message must immediately cancel the interaction that
        // belongs to the original Message event. Do this before dispatching the
        // separate message-delete event so the delete event itself is not queued
        // behind work that should already be gone.
        const linkedEventUuid = getEventUuidByMessageId(event.messageId);
        if (linkedEventUuid) {
            logRegular(`message deleted, cancel linked interaction/event: ${linkedEventUuid}`);

            cancelInteraction(linkedEventUuid);
            cancelMacroEvent(linkedEventUuid);
            removeAlertByEventUuid(linkedEventUuid);
            interruptSpeechByEventUuid(linkedEventUuid);
            removeEventFromQuery(linkedEventUuid);
            unlinkMessage(event.messageId);
        }

        // Fire the configured delete event even when the deleted message was not
        // originally linked to a Streambot message event.
        await this.triggerConfiguredEvent(payload);
    }
}
