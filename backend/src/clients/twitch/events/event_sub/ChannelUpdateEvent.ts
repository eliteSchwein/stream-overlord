import BaseEvent from "./BaseEvent";
import {fetchGameInfo, getCurrentGameId, pushGameInfo} from "../../../../helper/GameHelper";
import {editGameTracker, getGameInfoData, updateTwitchData} from "../../../website/WebsiteClient";
import {logNotice} from "../../../../helper/LogHelper";
import {updateChannelPoints} from "../../../../helper/ChannelPointHelper";
import {updateAdData} from "../../../../helper/SchedulerHelper";

export default class ChannelUpdateEvent extends BaseEvent {
    name = 'ChannelUpdateEvent'
    eventTypes = ['onChannelUpdate']

    async handle(event: any) {
        void updateAdData()

        const oldGameId = getCurrentGameId()

        if(oldGameId === Number.parseInt(event.categoryId)) return

        void editGameTracker(`${oldGameId}`, 'end')

        logNotice(`game change (${oldGameId} -> ${event.categoryId}) detected, load assets for ${event.categoryName}`)
        await updateTwitchData()
        await updateChannelPoints()
        await fetchGameInfo()
        pushGameInfo()

        await editGameTracker(event.categoryId)
    }
}