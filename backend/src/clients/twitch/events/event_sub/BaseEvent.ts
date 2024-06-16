import registerEventCooldown, {
    addEventToCooldown,
    isEventFull,
    removeEventFromCooldown
} from "../../helper/CooldownHelper";
import {logRegular} from "../../../../helper/LogHelper";
import {v4 as uuidv4} from 'uuid';
import {EventSubWsListener} from "@twurple/eventsub-ws";
import {Bot} from "@twurple/easy-bot";
import {getConfig} from "../../../../helper/ConfigHelper";
import {sleep} from "../../../../../../helper/GeneralHelper";

export default class BaseEvent {
    eventSubWs: EventSubWsListener
    bot: Bot

    name: string
    eventTypes = []
    eventLimit = 25
    eventCooldown = 5

    public constructor(eventSubWs: EventSubWsListener, bot: Bot) {
        this.eventSubWs = eventSubWs
        this.bot = bot
    }

    async register() {
        registerEventCooldown(this.name)

        const primaryChannel = await this.bot.api.users.getUserByName(
            getConfig(/twitch/g)[0]['channels'][0])

        logRegular(`register eventsub event: ${this.name}`)

        for(const eventType of this.eventTypes) {
            this.eventSubWs[eventType](primaryChannel.id, (event: any) => this.handleEvent(event))
        }

        void this.handleRegister()
    }

    async handleRegister() {

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