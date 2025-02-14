import BaseEvent from "./BaseEvent";
import {EventSubChannelRewardEvent} from "@twurple/eventsub-base";
import {updateActiveChannelPoint} from "../../../../helper/ChannelPointHelper";

export default class ChannelPointEditEvent extends BaseEvent {
    name = 'ChannelPointEditEvent'
    eventTypes = ['onChannelRewardUpdate']

    async handle(event: EventSubChannelRewardEvent) {
        updateActiveChannelPoint(event.id, !event.isPaused)
    }
}