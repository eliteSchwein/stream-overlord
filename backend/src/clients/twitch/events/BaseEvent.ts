import {Bot} from "@twurple/easy-bot";
import registerEventCooldown, {
    addEventToCooldown,
    isEventFull,
    queryEvent,
    removeEventFromCooldown,
    removeEventFromQuery
} from "../helper/CooldownHelper";
import {logError, logRegular} from "../../../helper/LogHelper";
import {v4 as uuidv4} from 'uuid';
import {sleep} from "../../../../../helper/GeneralHelper";

export default class BaseEvent {
    bot: Bot

    name: string
    eventTypes = []
    eventLimit = 25
    eventCooldown = 5
    eventUuid: string

    public constructor(bot: Bot) {
        this.bot = bot;
    }

    register() {
        registerEventCooldown(this.name)

        logRegular(`register event: ${this.name}`)

        for(const eventType of this.eventTypes) {
            this.bot[eventType]((event: any) => void this.handleEvent(event))
        }
    }

    private async handleEvent(event: any) {
        if(isEventFull(this.name, event.broadcasterName, this.eventLimit)) return

        this.eventUuid = uuidv4()

        queryEvent(this.eventUuid)
        addEventToCooldown(this.eventUuid, this.name, event.broadcasterName)

        try {
            await this.handle(event)
        } catch (error) {
            logError(`event ${this.name} failed:`)
            logError(JSON.stringify(error, Object.getOwnPropertyNames(error)))
        }

        await sleep(this.eventCooldown * 1000)

        removeEventFromCooldown(this.eventUuid, this.name, event.broadcasterName)
        removeEventFromQuery(this.eventUuid)
    }

    async handle(event: any) {}
}