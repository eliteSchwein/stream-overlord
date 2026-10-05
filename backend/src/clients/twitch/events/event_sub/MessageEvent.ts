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
        { name: "chatterUserId", type: "text" as const, localeKey: "events.simulation.fields.userId", default: "987654321", required: true },
        { name: "chatterUserName", type: "text" as const, localeKey: "events.simulation.fields.userName", default: "testviewer", required: true },
        { name: "chatterUserDisplayName", type: "text" as const, localeKey: "events.simulation.fields.userDisplayName", default: "TestViewer", required: true },
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
        const messageText = String(messageEvent.messageText ?? messageEvent.message?.text ?? "");
        const chatter = String(
            messageEvent.chatterUserDisplayName ??
            messageEvent.chatterUserName ??
            messageEvent.chatterUserId ??
            "unknown",
        );

        logRegular(`chat message from ${chatter}: ${messageText}`);

        // Keep the message -> event relation available to MessageDeleteEvent so a
        // deleted chat message can cancel macros, alerts and TTS started by it.
        linkMessageToEvent(messageId, this.eventUuid);

        await this.triggerConfiguredEvent(event);
    }
}
