import {Bot} from "@twurple/easy-bot";
import registerEventCooldown, {isEventFull, sleep} from "../helper/CooldownHelper";

export default class BaseEvent {
    private bot: Bot

    name: string
    eventTypes: string[]
    eventLimit = 25
    eventCooldown = 60

    public constructor(bot: Bot) {
        this.bot = bot;
    }

    public register() {
        registerEventCooldown(this.name)

        for(const eventType of this.eventTypes) {
            this.bot.on[eventType]((event: any) => void this.handleEvent(event))
        }
    }

    private async handleEvent(event: any) {
        if(isEventFull(this.name, event.broadcasterName, this.eventLimit)) return

        await this.handle(event)

        await sleep(this.eventCooldown * 1000)
    }

    async handle(event: any) {}
}