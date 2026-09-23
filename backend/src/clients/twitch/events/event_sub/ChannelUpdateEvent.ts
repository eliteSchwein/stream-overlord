import BaseEvent from "./BaseEvent";
import {
    getCurrentGameId,
} from "../../../../helper/GameHelper";
import {logNotice} from "../../../../helper/LogHelper";
import {updateAdData} from "../../../../helper/SchedulerHelper";
import {
    updateTwitchCategoryData,
    updateTwitchStreamData,
} from "../../../../helper/TwitchDataHelper";
import {syncTwitchCategory} from "../../../../helper/CategoryLibraryHelper";

export default class ChannelUpdateEvent extends BaseEvent {
    name = "ChannelUpdateEvent";
    eventTypes = ["onChannelUpdate"];
    configName = "event_twitch_channel_update";

    private async enrichCategoryEvent(event: any) {
        const categoryId = event?.categoryId;

        if (!categoryId) {
            return event;
        }

        try {
            const game = await this.bot.api.games.getGameById(categoryId);

            event.categoryImage = game?.boxArtUrl
                ? game.boxArtUrl
                    .replace("{width}", "600")
                    .replace("{height}", "800")
                : undefined;

            return event;
        } catch (error) {
            logNotice(
                `failed to load category image for ${event.categoryName} (${categoryId})`
            );

            return event;
        }
    }

    async handle(event: any) {
        void updateAdData();

        await updateTwitchStreamData(this.bot);
        await updateTwitchCategoryData(this.bot);

        const oldGameId = getCurrentGameId();
        const newGameId = Number.parseInt(event.categoryId);

        if (oldGameId === newGameId) return;

        logNotice(
            `game change (${oldGameId} -> ${event.categoryId}) detected, load assets for ${event.categoryName}`
        );


        // Twurple EventSub event fields such as categoryId/categoryName are
        // exposed via getters and are not guaranteed to be enumerable. Spreading
        // the event therefore drops the exact values the Category Library needs.
        // Copy the public channel-update fields explicitly before enriching it.
        const normalizedEvent = {
            broadcasterId: event?.broadcasterId,
            broadcasterName: event?.broadcasterName,
            broadcasterDisplayName: event?.broadcasterDisplayName,
            categoryId: event?.categoryId,
            categoryName: event?.categoryName,
            streamTitle: event?.streamTitle,
            streamLanguage: event?.streamLanguage,
            isMature: event?.isMature,
            previousCategoryId: oldGameId || undefined,
        };

        const enrichedEvent = await this.enrichCategoryEvent(normalizedEvent);

        // Category library is the local source of truth for theme/media/OBS data.
        // Activate/sync it before rebuilding game/theme state.
        await syncTwitchCategory(this.bot, enrichedEvent);

        // Category activation owns theme/media/Channel Points/OBS application and
        // the corresponding websocket notifications. Only fire the macro event
        // after the local category state is fully settled.

        // Keep the old event for compatibility.
        await this.triggerConfiguredEvent(enrichedEvent);

    }
}