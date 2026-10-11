import BaseEvent from "./BaseEvent";
import {getPrimaryChannel} from "../../../../helper/ConfigHelper";
import {logRegular} from "../../../../helper/LogHelper";

export default class AnnouncementEvent extends BaseEvent {
    name = "Announcement";
    configName = "event_twitch_announcement";
    eventTypes = [];
    eventLimit = 50;
    eventCooldown = 0;

    simulationFields = [
        { name: "messageId", type: "text" as const, localeKey: "events.simulation.fields.messageId", default: "00000000-0000-0000-0000-000000000001", required: true },
        { name: "messageText", type: "textarea" as const, localeKey: "events.simulation.fields.message", default: "Important announcement!", required: true },
        { name: "userId", type: "text" as const, localeKey: "events.simulation.fields.userId", default: "987654321", required: true },
        { name: "userName", type: "text" as const, localeKey: "events.simulation.fields.userName", default: "testmoderator", required: true },
        { name: "userDisplayName", type: "text" as const, localeKey: "events.simulation.fields.userDisplayName", default: "TestModerator", required: true },
        { name: "announcementColor", type: "text" as const, localeKey: "events.simulation.fields.color", default: "primary", required: false },
    ];

    async handleRegister() {
        const primaryChannel = getPrimaryChannel();

        this.eventSubWs.onChannelChatNotification(
            primaryChannel.id,
            primaryChannel.id,
            (event: any) => {
                // Chat notifications also contain subs, raids, gifts, etc. Only
                // announcements should enter this event's limiter/queue.
                if (event?.type !== "announcement" && event?.type !== "shared_chat_announcement") {
                    return;
                }

                void this.handleEvent(event);
            },
        );
    }

    async handle(event: any) {
        const userId = String(event.chatterId ?? event.userId ?? "");
        const userName = String(event.chatterName ?? event.userName ?? "");
        const userDisplayName = String(event.chatterDisplayName ?? event.userDisplayName ?? userName);
        const messageText = String(event.messageText ?? "");

        const payload = {
            type: event.type ?? "announcement",
            messageId: event.messageId ?? "",
            messageText,
            messageParts: event.messageParts ?? [],

            chatterId: userId,
            chatterName: userName,
            chatterDisplayName: userDisplayName,

            userId,
            userName,
            userDisplayName,

            broadcasterId: event.broadcasterId ?? "",
            broadcasterName: event.broadcasterName ?? "",
            broadcasterDisplayName: event.broadcasterDisplayName ?? "",

            color: event.color ?? null,
            announcementColor: event.announcementColor ?? null,
            badges: event.badges ?? {},

            sourceBroadcasterId: event.sourceBroadcasterId ?? null,
            sourceBroadcasterName: event.sourceBroadcasterName ?? null,
            sourceBroadcasterDisplayName: event.sourceBroadcasterDisplayName ?? null,
            sourceMessageId: event.sourceMessageId ?? null,
            isSourceOnly: event.isSourceOnly ?? null,
        };

        logRegular(`chat announcement from ${userDisplayName || userName || userId || "unknown"}: ${messageText}`);
        await this.triggerConfiguredEvent(payload);
    }
}
