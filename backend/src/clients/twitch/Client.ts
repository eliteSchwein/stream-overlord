import TwitchAuth from "./Auth";
import {getConfig, loadPrimaryChannel} from "../../helper/ConfigHelper";
import {Bot} from "@twurple/easy-bot";
import buildCommands from "./TwitchCommands";
import {EventSubWsListener} from "@twurple/eventsub-ws";
import ChannelPointsEvent from "./events/event_sub/ChannelPointsEvent";
import {waitUntil} from "async-wait-until";
import {logRegular} from "../../helper/LogHelper";
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
        this.auth = new TwitchAuth()
        let botActive = false

        const config = getConfig(/twitch/g)[0]

        let chatClientOptions = undefined

        //if(config.test_mode) {
         //   chatClientOptions = {
         //       secure: true,
         //       hostName: 'irc.fdgt.dev'
         //   }
        //}

        const authProvider = await this.auth.getAuthCode()

        const tempBot = new Bot({ authProvider, channels: config.channels, chatClientOptions: chatClientOptions})

        const commands = buildCommands(tempBot);

        this.bot = new Bot({ authProvider, channels: config.channels, chatClientOptions: chatClientOptions, commands })

        this.bot.onConnect(() => {botActive = true})

        await waitUntil(() => botActive, {
            intervalBetweenAttempts: 250,
        })

        await loadPrimaryChannel(this)

        logRegular('connect eventsub')

        this.eventSub = new EventSubWsListener({ apiClient: this.bot.api, logger: { minLevel: 'ERROR' } })
        this.eventSub.start()
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
}