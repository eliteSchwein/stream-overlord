import TwitchAuth from "./Auth";
import { getConfig, getPrimaryChannel, loadPrimaryChannel } from "../../helper/ConfigHelper";
import { Bot } from "@twurple/easy-bot";
import buildCommands from "./TwitchCommands";
import { EventSubWsListener } from "@twurple/eventsub-ws";
import ChannelPointsEvent from "./events/event_sub/ChannelPointsEvent";
import { waitUntil } from "async-wait-until";
import { logRegular, logSuccess, logWarn } from "../../helper/LogHelper";
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
import MessageDeleteEvent from "./events/event_sub/MessageDeleteEvent";

export default class TwitchClient {
    protected auth: TwitchAuth;
    protected bot: Bot;
    protected eventSub: EventSubWsListener;

    private warnTwitchNetworkError(context: string, error: unknown): boolean {
        const err = error as any;
        const cause = err?.cause;
        const code = cause?.code ?? err?.code;

        if (
            (err?.name === "TypeError" && err?.message === "fetch failed") ||
            code === "EAI_AGAIN" ||
            code === "UND_ERR_CONNECT_TIMEOUT"
        ) {
            logWarn(`${context}: temporary Twitch network error (${code ?? "fetch failed"})`);
            logWarn(cause?.message ?? err?.message ?? String(error));
            return true;
        }

        return false;
    }

    private async safeRegister(name: string, register: () => Promise<unknown> | unknown) {
        try {
            await register();
        } catch (error) {
            if (!this.warnTwitchNetworkError(`failed to register ${name}`, error)) {
                logWarn(`failed to register ${name}`);
                logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
            }
        }
    }

    protected async isAffiliateOrPartner(): Promise<boolean> {
        const primaryChannel = getPrimaryChannel();

        try {
            const user = await this.bot.api.users.getUserById(primaryChannel.id);

            if (!user) {
                logWarn(`could not load twitch user for primary channel id=${primaryChannel.id}`);
                return false;
            }

            const broadcasterType = String(user.broadcasterType ?? "").toLowerCase();

            logRegular(
                `twitch broadcaster type for ${primaryChannel.name ?? primaryChannel.id}: ${
                    broadcasterType || "(none)"
                }`
            );

            return broadcasterType === "affiliate" || broadcasterType === "partner";
        } catch (error) {
            if (!this.warnTwitchNetworkError("failed to check affiliate/partner status", error)) {
                logWarn("failed to check affiliate/partner status");
                logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
            }

            return false;
        }
    }

    public async connect() {
        if (this.bot?.chat) {
            logRegular("disconnect twitch");
            this.bot.chat.quit();
            this.bot = undefined;
        }

        if (this.eventSub) {
            logRegular("disconnect eventsub");
            this.eventSub.stop();
            this.eventSub = undefined;
        }

        logRegular("connect twitch");

        this.auth = new TwitchAuth();

        let botActive = false;
        const config = getConfig(/twitch/g)[0];
        const authProvider = await this.auth.getAuthCode();

        const tempBot = new Bot({
            authProvider,
            channels: config.channels
        });

        const commands = buildCommands(tempBot);

        this.bot = new Bot({
            authProvider,
            channels: config.channels,
            chatClientOptions: null,
            commands
        });

        this.bot.onConnect(() => {
            botActive = true;
        });

        await waitUntil(() => botActive, {
            intervalBetweenAttempts: 250,
            timeout: 30_000
        });

        await loadPrimaryChannel(this);

        logRegular("connect eventsub");

        this.eventSub = new EventSubWsListener({
            apiClient: this.bot.api,
            logger: { minLevel: "ERROR" }
        });

        try {
            this.eventSub.start();
        } catch (error) {
            if (!this.warnTwitchNetworkError("failed to start eventsub", error)) {
                logWarn("failed to start eventsub");
                logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
            }
        }

        await this.registerEvents();

        logSuccess("twitch client is ready");
    }

    public async registerEvents() {
        // regular events
        new SubEvent(this.bot).register();
        new CommunitySubEvent(this.bot).register();
        new SubGiftEvent(this.bot).register();
        new RaidEvent(this.bot).register();

        // eventsub events that work for all channels
        await this.safeRegister("follow event", () => new FollowEvent(this.eventSub, this.bot).register());
        await this.safeRegister("channel update event", () => new ChannelUpdateEvent(this.eventSub, this.bot).register());
        await this.safeRegister("shield event", () => new ShieldEvent(this.eventSub, this.bot).register());
        await this.safeRegister(
            "shared chat session end event",
            () => new ChannelSharedChatSessionEnd(this.eventSub, this.bot).register()
        );
        await this.safeRegister(
            "shared chat session event",
            () => new ChannelSharedChatSession(this.eventSub, this.bot).register()
        );
        await this.safeRegister(
            "message delete event",
            () => new MessageDeleteEvent(this.eventSub, this.bot).register()
        );

        const affiliateOrPartner = await this.isAffiliateOrPartner();

        if (!affiliateOrPartner) {
            logWarn("primary channel is not affiliate/partner - skipping monetization-related Twitch features");
            logWarn("Skipped: Channel Points, reward updates, Bits cheers, polls/predictions EventSub");
            return;
        }

        // eventsub events that require affiliate/partner features
        await this.safeRegister("channel points event", () => new ChannelPointsEvent(this.eventSub, this.bot).register());
        await this.safeRegister("bits event", () => new BitEvent(this.eventSub, this.bot).register());
        await this.safeRegister(
            "channel point edit event",
            () => new ChannelPointEditEvent(this.eventSub, this.bot).register()
        );
        await this.safeRegister(
            "poll prediction event",
            () => new PollPredictionEvent(this.eventSub, this.bot).register()
        );
    }

    public getBot() {
        return this.bot;
    }

    public getEventSub() {
        return this.eventSub;
    }

    public async announce(message: string, color: string = "primary") {
        const primaryChannel = getPrimaryChannel();

        try {
            await this.bot.api.chat.sendAnnouncement(primaryChannel.id, {
                message: message,
                // @ts-ignore
                color: color
            });
        } catch (error) {
            if (!this.warnTwitchNetworkError("twitch announce failed", error)) {
                logWarn("twitch announce failed:");
                logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
            }
        }
    }
}