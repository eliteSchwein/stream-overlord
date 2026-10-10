import BaseEvent from "./BaseEvent";
import type {EventSubChannelChatMessageEvent} from "@twurple/eventsub-base";
import {getPrimaryChannel} from "../../../../helper/ConfigHelper";
import {logRegular} from "../../../../helper/LogHelper";
import {linkMessageToEvent} from "../../../../helper/MessageEventLinkHelper";

export default class MessageEvent extends BaseEvent {
    name = "Message";
    configName = "event_twitch_message";
    eventTypes = [];

    simulationFields = [
        { name: "messageId", type: "text" as const, localeKey: "events.simulation.fields.messageId", default: "00000000-0000-0000-0000-000000000001", required: true },
        { name: "messageText", type: "textarea" as const, localeKey: "events.simulation.fields.message", default: "Hello Stream!", required: true },
        { name: "userId", type: "text" as const, localeKey: "events.simulation.fields.userId", default: "987654321", required: true },
        { name: "userName", type: "text" as const, localeKey: "events.simulation.fields.userName", default: "testviewer", required: true },
        { name: "userDisplayName", type: "text" as const, localeKey: "events.simulation.fields.userDisplayName", default: "TestViewer", required: true },
    ];

    async handleRegister() {
        const primaryChannel = getPrimaryChannel();

        this.eventSubWs.onChannelChatMessage(
            primaryChannel.id,
            primaryChannel.id,
            (event: EventSubChannelChatMessageEvent) => this.handleEvent(event),
        );
    }

    async handle(event: EventSubChannelChatMessageEvent) {
        const messageEvent = event as any;
        const messageId = String(messageEvent.messageId ?? "");
        const messageText = String(messageEvent.messageText ?? "");
        const chatterId = String(messageEvent.chatterId ?? "");
        const chatterName = String(messageEvent.chatterName ?? "");
        const chatterDisplayName = String(messageEvent.chatterDisplayName ?? chatterName ?? "");

        // Commands are handled by the dedicated command system and must not also
        // trigger the generic Twitch message event.
        if (messageText.startsWith("!")) {
            return;
        }

        // Replies are handled as part of their conversation thread and should not
        // trigger the generic standalone Twitch message event.
        if (messageEvent.parentMessageId) {
            return;
        }

        // Ignore messages authored by either authenticated bot account.
        // Use Twitch user IDs instead of login/display names so renames and casing
        // differences cannot accidentally make bot messages trigger this event.
        if (this.twitchClient?.isOwnAuthUserId(chatterId)) {
            return;
        }

        const payload = {
            messageId,
            messageText,
            messageType: messageEvent.messageType ?? null,
            messageParts: messageEvent.messageParts ?? [],

            chatterId,
            chatterName,
            chatterDisplayName,

            // Generic user aliases used by the other Twitch events/macros.
            userId: chatterId,
            userName: chatterName,
            userDisplayName: chatterDisplayName,

            broadcasterId: messageEvent.broadcasterId ?? "",
            broadcasterName: messageEvent.broadcasterName ?? "",
            broadcasterDisplayName: messageEvent.broadcasterDisplayName ?? "",

            color: messageEvent.color ?? null,
            badges: messageEvent.badges ?? {},
            bits: messageEvent.bits ?? 0,
            isCheer: messageEvent.isCheer === true,
            isRedemption: messageEvent.isRedemption === true,
            rewardId: messageEvent.rewardId ?? null,

            parentMessageId: messageEvent.parentMessageId ?? null,
            parentMessageText: messageEvent.parentMessageText ?? null,
            parentMessageUserId: messageEvent.parentMessageUserId ?? null,
            parentMessageUserName: messageEvent.parentMessageUserName ?? null,
            parentMessageUserDisplayName: messageEvent.parentMessageUserDisplayName ?? null,

            threadMessageId: messageEvent.threadMessageId ?? null,
            threadMessageUserId: messageEvent.threadMessageUserId ?? null,
            threadMessageUserName: messageEvent.threadMessageUserName ?? null,
            threadMessageUserDisplayName: messageEvent.threadMessageUserDisplayName ?? null,

            sourceBroadcasterId: messageEvent.sourceBroadcasterId ?? null,
            sourceBroadcasterName: messageEvent.sourceBroadcasterName ?? null,
            sourceBroadcasterDisplayName: messageEvent.sourceBroadcasterDisplayName ?? null,
            sourceMessageId: messageEvent.sourceMessageId ?? null,
            isSourceOnly: messageEvent.isSourceOnly ?? null,
        };

        logRegular(`chat message from ${chatterDisplayName || chatterName || chatterId || "unknown"}: ${messageText}`);

        // Keep the message -> event relation available to MessageDeleteEvent so a
        // deleted chat message can cancel macros, alerts and TTS started by it.
        if (messageId) {
            linkMessageToEvent(messageId, this.eventUuid);
        }

        await this.triggerConfiguredEvent(payload);
    }
}
