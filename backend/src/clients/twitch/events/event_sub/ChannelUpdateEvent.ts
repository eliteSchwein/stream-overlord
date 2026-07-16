import BaseEvent from "./BaseEvent";
import {fetchGameInfo, getCurrentGameId, pushGameInfo,} from "../../../../helper/GameHelper";
import {updateTwitchData} from "../../../website/WebsiteClient";
import {logNotice} from "../../../../helper/LogHelper";
import {updateChannelPoints} from "../../../../helper/ChannelPointHelper";
import {updateAdData} from "../../../../helper/SchedulerHelper";
import {updateSourceFilters} from "../../../../helper/SourceHelper";
import {sleep} from "../../../../../../helper/GeneralHelper";
import {updateTwitchCategoryData, updateTwitchStreamData,} from "../../../../helper/TwitchDataHelper";

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

        await updateTwitchData();
        await updateChannelPoints(true);
        await fetchGameInfo();
        pushGameInfo();

        await updateSourceFilters();

        // idk why but this is needed
        await sleep(1_000);
        await updateSourceFilters();

        const enrichedEvent = await this.enrichCategoryEvent(event);

        await this.triggerConfiguredEvent(enrichedEvent);
    }
}