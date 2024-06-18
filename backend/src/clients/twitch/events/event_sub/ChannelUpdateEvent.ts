import BaseEvent from "./BaseEvent";
import {fetchTheme, pushTheme} from "../../../../helper/ThemeHelper";
import {updateTwitchData} from "../../../website/WebsiteClient";
import {logNotice} from "../../../../helper/LogHelper";

export default class ChannelUpdateEvent extends BaseEvent {
    name = 'ChannelUpdateEvent'
    eventTypes = ['onChannelUpdate']

    async handle(event: any) {
        logNotice('update theme assets on website')
        await updateTwitchData()
        await fetchTheme()
        pushTheme()
    }
}