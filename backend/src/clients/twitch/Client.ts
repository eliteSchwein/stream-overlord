import TwitchAuth from "./Auth";
import {getConfig} from "../../helper/ConfigHelper";
import {Bot} from "@twurple/easy-bot";
import buildCommands from "./TwitchCommands";
import {EventSubWsListener} from "@twurple/eventsub-ws";
import ChannelPointsEvent from "./events/event_sub/ChannelPointsEvent";
import {waitUntil} from "async-wait-until";
import {logRegular} from "../../helper/LogHelper";
import ChannelUpdateEvent from "./events/event_sub/ChannelUpdateEvent";

export default class TwitchClient {
    protected auth: TwitchAuth
    protected bot: Bot
    protected eventSub: EventSubWsListener

    public async connect() {
        this.auth = new TwitchAuth()
        let botActive = false

        const config = getConfig(/twitch/g)[0]

        const authProvider = await this.auth.getAuthCode()

        const tempBot = new Bot({ authProvider, channels: config.channels })

        const commands = buildCommands(tempBot);

        this.bot = new Bot({ authProvider, channels: config.channels, commands })

        this.bot.onConnect(() => {botActive = true})

        await waitUntil(() => botActive, {
            intervalBetweenAttempts: 250,
        })

        logRegular('connect eventsub')

        this.eventSub = new EventSubWsListener({ apiClient: this.bot.api, logger: { minLevel: 'ERROR' } })
        this.eventSub.start()
    }

    public async registerEvents() {
        // regular events

        // eventsub events
        await new ChannelPointsEvent(this.eventSub, this.bot).register()
        await new ChannelUpdateEvent(this.eventSub, this.bot).register()
    }

    public getBot() {
        return this.bot
    }

    public getEventSub() {
        return this.eventSub
    }
}