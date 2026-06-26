import BaseEvent from "./BaseEvent";
import {EventSubChannelRewardEvent} from "@twurple/eventsub-base";
import {emitChannelPointConfigUpdate, updateActiveChannelPoint} from "../../../../helper/ChannelPointHelper";

export default class ChannelPointEditEvent extends BaseEvent {
    name = 'ChannelPointEditEvent'
    eventTypes = ['onChannelRewardUpdate']
    configName = 'event_twitch_channelpoint_edit'

    async handle(event: EventSubChannelRewardEvent) {
        updateActiveChannelPoint(event.id, !event.isPaused)

        emitChannelPointConfigUpdate()

        await this.triggerConfiguredEvent(event)
    }
}