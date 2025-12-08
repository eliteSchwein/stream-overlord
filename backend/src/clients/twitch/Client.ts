import TwitchAuth from "./Auth";
import {getConfig, getPrimaryChannel, loadPrimaryChannel} from "../../helper/ConfigHelper";
import {Bot} from "@twurple/easy-bot";
import buildCommands from "./TwitchCommands";
import {EventSubWsListener} from "@twurple/eventsub-ws";
import ChannelPointsEvent from "./events/event_sub/ChannelPointsEvent";
import {waitUntil} from "async-wait-until";
import {logRegular, logSuccess, logWarn} from "../../helper/LogHelper";
import ChannelUpdateEvent from "./events/event_sub/ChannelUpdateEvent";
import SubEvent from "./events/SubEvent";
import CommunitySubEvent from "./events/CommunitySubEvent";
import SubGiftEvent from "./events/SubGiftEvent";
import BitEvent from "./events/event_sub/BitEvent";
import RaidEvent from "./events/RaidEvent";
import FollowEvent from "./events/event_sub/FollowEvent";
import ShieldEvent from "./events/event_sub/ShieldEvent";
import ChannelPointEditEvent from "./events/event_sub/ChannelPointEditEvent";
import ChannelSharedChatSessionEnd from "./events/event_sub/ChannelSharedChatSessionEnd";
import ChannelSharedChatSession from "./events/event_sub/ChannelSharedChatSession";
import PollPredictionEvent from "./events/event_sub/PollPredictionEvent";

export default class TwitchClient {
    protected auth: TwitchAuth
    protected bot: Bot
    protected eventSub: EventSubWsListener

    public async connect() {
        if (this.bot?.chat) {
            logRegular("disconnect twitch")
            this.bot.chat.quit()
            this.bot = undefined
        }

        if (this.eventSub) {
            logRegular("disconnect eventsub")
            this.eventSub.stop()
            this.eventSub = undefined
        }

        logRegular('connect twitch')

        this.auth = new TwitchAuth()
        let botActive = false

        const config = getConfig(/twitch/g)[0]

        const authProvider = await this.auth.getAuthCode()

        const tempBot = new Bot({ authProvider, channels: config.channels})

        const commands = buildCommands(tempBot);

        this.bot = new Bot({ authProvider, channels: config.channels, chatClientOptions: null, commands })

        this.bot.onConnect(() => {botActive = true})

        await waitUntil(() => botActive, {
            intervalBetweenAttempts: 250,
            timeout: 30_000
        })

        await loadPrimaryChannel(this)

        logRegular('connect eventsub')

        this.eventSub = new EventSubWsListener({ apiClient: this.bot.api, logger: { minLevel: 'ERROR' } })
        this.eventSub.start()

        await this.registerEvents()
        logSuccess('twitch client is ready')
    }

    public async registerEvents() {
        // regular events
        new SubEvent(this.bot).register()
        new CommunitySubEvent(this.bot).register()
        new SubGiftEvent(this.bot).register()
        new RaidEvent(this.bot).register()

        // eventsub events
        await new FollowEvent(this.eventSub, this.bot).register()
        await new ChannelPointsEvent(this.eventSub, this.bot).register()
        await new ChannelUpdateEvent(this.eventSub, this.bot).register()
        await new BitEvent(this.eventSub, this.bot).register()
        await new ShieldEvent(this.eventSub, this.bot).register()
        await new ChannelPointEditEvent(this.eventSub, this.bot).register()
        await new ChannelSharedChatSessionEnd(this.eventSub, this.bot).register()
        await new ChannelSharedChatSession(this.eventSub, this.bot).register()
        await new PollPredictionEvent(this.eventSub, this.bot).register()
    }

    public getBot() {
        return this.bot
    }

    public getEventSub() {
        return this.eventSub
    }

    public async announce(message: string, color: string = 'primary') {
        const primaryChannel = getPrimaryChannel()

        try {
            await this.bot.api.chat.sendAnnouncement(
                primaryChannel.id,
                {
                    message: message,
                    // @ts-ignore
                    color: color // 'primary' | 'blue' | 'green' | 'orange' | 'purple'
                }
            )
        } catch (error) {
            logWarn('twitch announce failed:')
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
        }
    }
}