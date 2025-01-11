import BaseEvent from "./BaseEvent";
import {fetchTheme, pushTheme} from "../../../../helper/ThemeHelper";
import getThemeData, {editGameTracker, updateTwitchData} from "../../../website/WebsiteClient";
import {logNotice} from "../../../../helper/LogHelper";

export default class ChannelUpdateEvent extends BaseEvent {
    name = 'ChannelUpdateEvent'
    eventTypes = ['onChannelUpdate']

    async handle(event: any) {
        const oldThemeData = await getThemeData()

        if(oldThemeData.game_id === Number.parseInt(event.categoryId)) return

        await editGameTracker(oldThemeData.game_id, 'end')

        logNotice('update theme assets on website')
        await updateTwitchData()
        await fetchTheme()
        pushTheme()

        await editGameTracker(event.categoryId)
    }
}