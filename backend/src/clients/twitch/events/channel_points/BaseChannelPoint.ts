import {EventSubChannelRedemptionAddEvent} from "@twurple/eventsub-base";

export default class BaseChannelPoint {
    title: string

    public async handleChannelPoint(event: EventSubChannelRedemptionAddEvent) {
        if(event.rewardTitle !== this.title) return

        await this.handle(event)
    }

    async handle(event: EventSubChannelRedemptionAddEvent) {

    }
}