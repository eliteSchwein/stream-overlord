import BaseEvent from "./BaseEvent";
import {fetchGameInfo, getCurrentGameId, pushGameInfo} from "../../../../helper/GameHelper";
import {updateTwitchData} from "../../../website/WebsiteClient";
import {logNotice} from "../../../../helper/LogHelper";
import {updateChannelPoints} from "../../../../helper/ChannelPointHelper";
import {updateAdData} from "../../../../helper/SchedulerHelper";
import {updateSourceFilters} from "../../../../helper/SourceHelper";
import {sleep} from "../../../../../../helper/GeneralHelper";
import {updateTwitchCategoryData, updateTwitchStreamData} from "../../../../helper/TwitchDataHelper";

export default class ChannelUpdateEvent extends BaseEvent {
    name = 'ChannelUpdateEvent'
    eventTypes = ['onChannelUpdate']
    configName = 'event_twitch_channel_update'

    async handle(event: any) {
        await this.triggerConfiguredEvent(event)
        void updateAdData()
        await updateTwitchStreamData(this.bot)
        await updateTwitchCategoryData(this.bot)

        const oldGameId = getCurrentGameId()

        if(oldGameId === Number.parseInt(event.categoryId)) return

        logNotice(`game change (${oldGameId} -> ${event.categoryId}) detected, load assets for ${event.categoryName}`)
        await updateTwitchData()
        await updateChannelPoints()
        await fetchGameInfo()
        pushGameInfo()

        // await editGameTracker(event.categoryId)
        await updateSourceFilters()

        // idk why but this is needed
        await sleep(1_000)
        await updateSourceFilters()

        await this.triggerConfiguredEvent(event)
    }
}