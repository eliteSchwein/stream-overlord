import {EventSubChannelRedemptionAddEvent} from "@twurple/eventsub-base";
import {logRegular} from "../../../../helper/LogHelper";

export default class BaseChannelPoint {
    title: string

    public async handleChannelPoint(event: EventSubChannelRedemptionAddEvent) {
        if(event.rewardTitle !== this.title) return

        logRegular(`channel point redeemed by ${event.userName}: ${this.title} ${event.input}`)

        await this.handle(event)
    }

    async handle(event: EventSubChannelRedemptionAddEvent) {

    }

    public getTitle() {
        return this.title
    }
}