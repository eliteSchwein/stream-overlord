import TwitchAuth from "./Auth";
import { getConfig, getPrimaryChannel, loadPrimaryChannel } from "../../helper/ConfigHelper";
import { Bot } from "@twurple/easy-bot";
import buildCommands from "./TwitchCommands";
import { EventSubWsListener } from "@twurple/eventsub-ws";
import ChannelPointsEvent from "./events/event_sub/ChannelPointsEvent";
import { waitUntil } from "async-wait-until";
import { logRegular, logSuccess, logWarn } from "../../helper/LogHelper";
import { setManagedConnection } from "../../helper/ConnectionHelper";
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
    protected bot?: Bot;
    protected eventSub?: EventSubWsListener;

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
            const user = await this.bot?.api.users.getUserById(primaryChannel.id);

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
        setManagedConnection("twitch", {
            enabled: true,
            state: "connecting",
            connected: false,
            message: "connecting"
        });

        this.auth = new TwitchAuth();

        let botActive = false;
        const config = getConfig(/twitch/g)[0];
        const authRequired = config?.auth_required === true || config?.authRequired === true;
        const authProvider = await this.auth.getAuthCode(authRequired);

        if (!authProvider) {
            setManagedConnection("twitch", {
                enabled: false,
                state: "auth_required",
                connected: false,
                message: "Twitch auth is not configured"
            });
            logWarn("twitch client skipped because auth is not configured");
            return;
        }

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

        try {
            await waitUntil(() => botActive, {
                intervalBetweenAttempts: 250,
                timeout: 30_000
            });
        } catch (error) {
            setManagedConnection("twitch", {
                enabled: true,
                state: "error",
                connected: false,
                message: "Twitch chat connection timed out"
            });
            throw error;
        }

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

        setManagedConnection("twitch", {
            enabled: true,
            state: "connected",
            connected: true,
            message: "connected"
        });

        logSuccess("twitch client is ready");
    }

    public async registerEvents() {
        if (!this.bot || !this.eventSub) {
            logWarn("cannot register Twitch events without an active Twitch connection");
            return;
        }

        const bot = this.bot;
        const eventSub = this.eventSub;

        // regular events
        new SubEvent(bot).register();
        new CommunitySubEvent(bot).register();
        new SubGiftEvent(bot).register();
        new RaidEvent(bot).register();

        // eventsub events that work for all channels
        await this.safeRegister("follow event", () => new FollowEvent(eventSub, bot).register());
        await this.safeRegister("channel update event", () => new ChannelUpdateEvent(eventSub, bot).register());
        await this.safeRegister("shield event", () => new ShieldEvent(eventSub, bot).register());
        await this.safeRegister(
            "shared chat session end event",
            () => new ChannelSharedChatSessionEnd(eventSub, bot).register()
        );
        await this.safeRegister(
            "shared chat session event",
            () => new ChannelSharedChatSession(eventSub, bot).register()
        );
        await this.safeRegister(
            "message delete event",
            () => new MessageDeleteEvent(eventSub, bot).register()
        );

        const affiliateOrPartner = await this.isAffiliateOrPartner();

        if (!affiliateOrPartner) {
            logWarn("primary channel is not affiliate/partner - skipping monetization-related Twitch features");
            logWarn("Skipped: Channel Points, reward updates, Bits cheers, polls/predictions EventSub");
            return;
        }

        // eventsub events that require affiliate/partner features
        await this.safeRegister("channel points event", () => new ChannelPointsEvent(eventSub, bot).register());
        await this.safeRegister("bits event", () => new BitEvent(eventSub, bot).register());
        await this.safeRegister(
            "channel point edit event",
            () => new ChannelPointEditEvent(eventSub, bot).register()
        );
        await this.safeRegister(
            "poll prediction event",
            () => new PollPredictionEvent(eventSub, bot).register()
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
            if (!this.bot) {
                logWarn("twitch announce skipped: twitch is not connected");
                return;
            }

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