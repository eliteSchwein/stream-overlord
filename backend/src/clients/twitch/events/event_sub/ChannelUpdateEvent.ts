import BaseEvent from "./BaseEvent";
import {fetchTheme, pushTheme} from "../../../../helper/ThemeHelper";
import getThemeData, {editGameTracker, updateTwitchData} from "../../../website/WebsiteClient";
import {logNotice} from "../../../../helper/LogHelper";
import {updateChannelPoints} from "../../../../helper/ChannelPointHelper";
import {updateAdData} from "../../../../helper/SchedulerHelper";

export default class ChannelUpdateEvent extends BaseEvent {
    name = 'ChannelUpdateEvent'
    eventTypes = ['onChannelUpdate']

    async handle(event: any) {
        await updateAdData()

        const oldThemeData = await getThemeData()

        if(oldThemeData.game_id === Number.parseInt(event.categoryId)) return

        await editGameTracker(oldThemeData.game_id, 'end')

        logNotice(`game change detected, load assets for ${event.categoryName}`)
        await updateTwitchData()
        await updateChannelPoints()
        await fetchTheme()
        pushTheme()

        await editGameTracker(event.categoryId)
    }
}