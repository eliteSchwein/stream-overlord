import {Bot} from "@twurple/easy-bot";
import registerEventCooldown, {
    addEventToCooldown,
    isEventFull,
    removeEventFromCooldown,
    sleep
} from "../helper/CooldownHelper";
import {logRegular} from "../../../helper/LogHelper";
import {v4 as uuidv4} from 'uuid';

export default class BaseEvent {
    bot: Bot

    name: string
    eventTypes: string[]
    eventLimit = 25
    eventCooldown = 5

    public constructor(bot: Bot) {
        this.bot = bot;
    }

    register() {
        registerEventCooldown(this.name)

        logRegular(`register event ${this.name}`)

        for(const eventType of this.eventTypes) {
            this.bot.on[eventType]((event: any) => void this.handleEvent(event))
        }
    }

    private async handleEvent(event: any) {
        if(isEventFull(this.name, event.broadcasterName, this.eventLimit)) return

        const eventUuid = uuidv4()

        addEventToCooldown(eventUuid, this.name, event.broadcasterName)

        await this.handle(event)

        await sleep(this.eventCooldown * 1000)

        removeEventFromCooldown(eventUuid, this.name, event.broadcasterName)
    }

    async handle(event: any) {}
}