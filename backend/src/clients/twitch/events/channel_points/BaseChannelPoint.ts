import {EventSubChannelRedemptionAddEvent} from "@twurple/eventsub-base";
import {isEventFull} from "../../helper/CooldownHelper";

export default class BaseChannelPoint {
    title: string

    public async handleChannelPoint(event: EventSubChannelRedemptionAddEvent) {
    }
}