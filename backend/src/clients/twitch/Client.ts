import TwitchAuth from "./Auth";
import {getConfig, getPrimaryChannel, loadPrimaryChannel} from "../../helper/ConfigHelper";
import {Bot} from "@twurple/easy-bot";
import buildCommands from "./TwitchCommands";
import {EventSubWsListener} from "@twurple/eventsub-ws";
import {logRegular, logSuccess, logWarn} from "../../helper/LogHelper";
import {setManagedConnection} from "../../helper/ConnectionHelper";

// regular EasyBot events
import SubEvent from "./events/SubEvent";
import CommunitySubEvent from "./events/CommunitySubEvent";
import SubGiftEvent from "./events/SubGiftEvent";
import RaidEvent from "./events/RaidEvent";

// EventSub events
import ChannelAdBreakBeginEvent from "./events/event_sub/ChannelAdBreakBeginEvent";
import ChannelBanEvent from "./events/event_sub/ChannelBanEvent";
import ChannelCharityCampaignProgressEvent from "./events/event_sub/ChannelCharityCampaignProgressEvent";
import ChannelCharityCampaignStartEvent from "./events/event_sub/ChannelCharityCampaignStartEvent";
import ChannelCharityCampaignStopEvent from "./events/event_sub/ChannelCharityCampaignStopEvent";
import ChannelCharityDonationEvent from "./events/event_sub/ChannelCharityDonationEvent";
import ChannelGoalBeginEvent from "./events/event_sub/ChannelGoalBeginEvent";
import ChannelGoalEndEvent from "./events/event_sub/ChannelGoalEndEvent";
import ChannelGoalProgressEvent from "./events/event_sub/ChannelGoalProgressEvent";
import ChannelHypeTrainBeginEvent from "./events/event_sub/ChannelHypeTrainBeginEvent";
import ChannelHypeTrainEndEvent from "./events/event_sub/ChannelHypeTrainEndEvent";
import ChannelHypeTrainProgressEvent from "./events/event_sub/ChannelHypeTrainProgressEvent";
import ChannelModeratorAddEvent from "./events/event_sub/ChannelModeratorAddEvent";
import ChannelModeratorRemoveEvent from "./events/event_sub/ChannelModeratorRemoveEvent";
import ChannelPointEditEvent from "./events/event_sub/ChannelPointEditEvent";
import ChannelPointsEvent from "./events/event_sub/ChannelPointsEvent";
import ChannelSharedChatSession from "./events/event_sub/ChannelSharedChatSession";
import ChannelSharedChatSessionEnd from "./events/event_sub/ChannelSharedChatSessionEnd";
import ChannelUnbanEvent from "./events/event_sub/ChannelUnbanEvent";
import ChannelUpdateEvent from "./events/event_sub/ChannelUpdateEvent";
import ChannelVipAddEvent from "./events/event_sub/ChannelVipAddEvent";
import ChannelVipRemoveEvent from "./events/event_sub/ChannelVipRemoveEvent";
import CheerEvent from "./events/event_sub/CheerEvent";
import FollowEvent from "./events/event_sub/FollowEvent";
import MessageDeleteEvent from "./events/event_sub/MessageDeleteEvent";
import PollPredictionEvent from "./events/event_sub/PollPredictionEvent";
import PollProgressEvent from "./events/event_sub/PollProgressEvent";
import PredictionLockEvent from "./events/event_sub/PredictionLockEvent";
import PredictionProgressEvent from "./events/event_sub/PredictionProgressEvent";
import ShieldEvent from "./events/event_sub/ShieldEvent";
import StreamOfflineEvent from "./events/event_sub/StreamOfflineEvent";
import StreamOnlineEvent from "./events/event_sub/StreamOnlineEvent";
import UserUpdateEvent from "./events/event_sub/UserUpdateEvent";
import {updateTwitchData} from "../../helper/TwitchDataHelper";

type TwitchMessageColor = "blue" | "green" | "orange" | "purple" | "primary";

export default class TwitchClient {
    protected auth: TwitchAuth;
    protected messageAuth?: TwitchAuth;

    protected bot?: Bot;
    protected messageBot?: Bot;

    protected controlAuthUserId?: string;
    protected messageAuthUserId?: string;

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

    private async loadStoredAuthUserId(auth: TwitchAuth, type: "message" | "control") {
        const token = await auth.getStoredToken(type);

        if (!token?.userId) {
            logWarn(`twitch ${type} auth has no stored user id - please reconnect this auth`);
            return undefined;
        }

        if (type === "message") {
            this.messageAuthUserId = token.userId;
        } else {
            this.controlAuthUserId = token.userId;
        }

        logRegular(
            `twitch ${type} auth connected as ${token.login ?? "-"} ` +
            `(id=${token.userId})`
        );

        return token.userId;
    }

    private getAuthUserId(authName: "message" | "control") {
        return authName === "message"
            ? this.messageAuthUserId
            : this.controlAuthUserId;
    }

    private async tryMessageAuth(config: any) {
        this.messageAuth = new TwitchAuth();

        try {
            const messageAuthProvider = await this.messageAuth.getAuthCode(false, "message" as any);

            if (!messageAuthProvider) {
                logWarn("twitch message auth is not configured - outgoing messages use control auth");
                return;
            }

            this.messageBot = new Bot({
                authProvider: messageAuthProvider,
                channels: config.channels,
                chatClientOptions: null,
            });

            await this.loadStoredAuthUserId(this.messageAuth, "message");

            logSuccess("twitch message auth is ready");
        } catch (error) {
            this.messageBot = undefined;

            if (!this.warnTwitchNetworkError("failed to initialize twitch message auth", error)) {
                logWarn("failed to initialize twitch message auth - outgoing messages use control auth");
                logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
            }
        }
    }

    private getOutgoingBots() {
        return [
            {name: "message", bot: this.messageBot},
            {name: "control", bot: this.bot},
        ].filter(entry => !!entry.bot) as {name: "message" | "control"; bot: Bot}[];
    }

    private async withMessageFallback(
        actionName: string,
        action: (bot: Bot, authName: "message" | "control") => Promise<void>
    ) {
        const bots = this.getOutgoingBots();

        if (!bots.length) {
            logWarn(`twitch ${actionName} skipped: twitch is not connected`);
            return;
        }

        let lastError: unknown = null;

        for (const entry of bots) {
            try {
                await action(entry.bot, entry.name);

                if (entry.name === "message") {
                    logRegular(`twitch ${actionName} sent via message auth`);
                }

                return;
            } catch (error) {
                lastError = error;

                if (entry.name === "message") {
                    logWarn(`twitch ${actionName} via message auth failed - fallback to control auth`);
                    logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
                    continue;
                }

                if (!this.warnTwitchNetworkError(`twitch ${actionName} failed`, error)) {
                    logWarn(`twitch ${actionName} failed:`);
                    logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
                }
            }
        }

        if (lastError) {
            logWarn(`twitch ${actionName} failed on all auth providers`);
        }
    }


    private async waitForControlChatConnection(timeoutMs = 30_000): Promise<boolean> {
        if (!this.bot) return false;

        const chat = (this.bot as any).chat;

        const isConnected = typeof chat?.isConnected === "function"
            ? chat.isConnected()
            : chat?.isConnected;

        if (isConnected === true) {
            return true;
        }

        return new Promise(resolve => {
            let finished = false;
            let timeout: ReturnType<typeof setTimeout>;

            const finish = (connected: boolean) => {
                if (finished) return;

                finished = true;
                clearTimeout(timeout);
                resolve(connected);
            };

            timeout = setTimeout(() => finish(false), timeoutMs);

            this.bot?.onConnect(() => finish(true));

            if (typeof chat?.onConnect === "function") {
                chat.onConnect(() => finish(true));
            }

            if (typeof chat?.onDisconnect === "function") {
                chat.onDisconnect((_manually: boolean, reason?: Error) => {
                    if (reason) {
                        logWarn(`twitch chat disconnected while connecting: ${reason.message}`);
                    }
                });
            }
        });
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

        if (this.messageBot?.chat) {
            logRegular("disconnect twitch message bot");
            this.messageBot.chat.quit();
            this.messageBot = undefined;
        }

        this.controlAuthUserId = undefined;
        this.messageAuthUserId = undefined;

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

        const config = getConfig(/twitch/g)[0];
        const authRequired = config?.auth_required === true || config?.authRequired === true;

        const authProvider = await this.auth.getAuthCode(authRequired, "control" as any);

        if (!authProvider) {
            setManagedConnection("twitch", {
                enabled: false,
                state: "auth_required",
                connected: false,
                message: "Twitch control auth is not configured"
            });
            logWarn("twitch client skipped because control auth is not configured");
            return;
        }

        const tempBot = new Bot({
            authProvider,
            channels: config.channels
        });

        const commands = buildCommands(tempBot, this);

        this.bot = new Bot({
            authProvider,
            channels: config.channels,
            chatClientOptions: null,
            commands
        });

        await this.loadStoredAuthUserId(this.auth, "control");

        await this.tryMessageAuth(config);

        const chatConnected = await this.waitForControlChatConnection();

        if (!chatConnected) {
            logWarn("twitch chat connection timed out after 30000 ms - continuing with API/EventSub setup");
            setManagedConnection("twitch", {
                enabled: true,
                state: "chat_timeout",
                connected: false,
                message: "Twitch auth is ready, but chat did not connect yet"
            });
        }

        await loadPrimaryChannel(this);
        await updateTwitchData(this.bot);

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
            state: chatConnected ? "connected" : "chat_timeout",
            connected: chatConnected,
            message: chatConnected
                ? "connected"
                : "Twitch API/EventSub is ready, but chat did not connect yet"
        });

        logSuccess(chatConnected
            ? "twitch client is ready"
            : "twitch api/eventsub is ready, but chat did not connect yet"
        );
    }

    public async registerEvents() {
        if (!this.bot || !this.eventSub) {
            logWarn("cannot register Twitch events without an active Twitch connection");
            return;
        }

        const bot = this.bot;
        const eventSub = this.eventSub;

        new SubEvent(bot, this).register();
        new CommunitySubEvent(bot, this).register();
        new SubGiftEvent(bot, this).register();
        new RaidEvent(bot, this).register();

        await this.safeRegister("follow event", () => new FollowEvent(eventSub, bot).register());
        await this.safeRegister("channel update event", () => new ChannelUpdateEvent(eventSub, bot).register());
        await this.safeRegister("user update event", () => new UserUpdateEvent(eventSub, bot).register());
        await this.safeRegister("stream online event", () => new StreamOnlineEvent(eventSub, bot).register());
        await this.safeRegister("stream offline event", () => new StreamOfflineEvent(eventSub, bot).register());
        await this.safeRegister("shield event", () => new ShieldEvent(eventSub, bot).register());
        await this.safeRegister("message delete event", () => new MessageDeleteEvent(eventSub, bot).register());
        await this.safeRegister("channel ban event", () => new ChannelBanEvent(eventSub, bot).register());
        await this.safeRegister("channel unban event", () => new ChannelUnbanEvent(eventSub, bot).register());
        await this.safeRegister("channel moderator add event", () => new ChannelModeratorAddEvent(eventSub, bot).register());
        await this.safeRegister("channel moderator remove event", () => new ChannelModeratorRemoveEvent(eventSub, bot).register());
        await this.safeRegister("channel vip add event", () => new ChannelVipAddEvent(eventSub, bot).register());
        await this.safeRegister("channel vip remove event", () => new ChannelVipRemoveEvent(eventSub, bot).register());
        await this.safeRegister("shared chat session event", () => new ChannelSharedChatSession(eventSub, bot).register());
        await this.safeRegister("shared chat session end event", () => new ChannelSharedChatSessionEnd(eventSub, bot).register());

        const affiliateOrPartner = await this.isAffiliateOrPartner();

        if (!affiliateOrPartner) {
            logWarn("primary channel is not affiliate/partner - skipping monetization-related Twitch features");
            logWarn("Skipped: Channel Points, reward updates, Bits cheers, polls/predictions, hype trains, goals, ads and charity EventSub");
            return;
        }

        await this.safeRegister("channel ad break begin event", () => new ChannelAdBreakBeginEvent(eventSub, bot).register());
        await this.safeRegister("channel points event", () => new ChannelPointsEvent(eventSub, bot).register());
        await this.safeRegister("channel point edit event", () => new ChannelPointEditEvent(eventSub, bot).register());
        await this.safeRegister("bits event", () => new CheerEvent(eventSub, bot).register());
        await this.safeRegister("poll prediction event", () => new PollPredictionEvent(eventSub, bot).register());
        await this.safeRegister("poll progress event", () => new PollProgressEvent(eventSub, bot).register());
        await this.safeRegister("prediction lock event", () => new PredictionLockEvent(eventSub, bot).register());
        await this.safeRegister("prediction progress event", () => new PredictionProgressEvent(eventSub, bot).register());
        await this.safeRegister("channel hype train begin event", () => new ChannelHypeTrainBeginEvent(eventSub, bot).register());
        await this.safeRegister("channel hype train progress event", () => new ChannelHypeTrainProgressEvent(eventSub, bot).register());
        await this.safeRegister("channel hype train end event", () => new ChannelHypeTrainEndEvent(eventSub, bot).register());
        await this.safeRegister("channel goal begin event", () => new ChannelGoalBeginEvent(eventSub, bot).register());
        await this.safeRegister("channel goal progress event", () => new ChannelGoalProgressEvent(eventSub, bot).register());
        await this.safeRegister("channel goal end event", () => new ChannelGoalEndEvent(eventSub, bot).register());
        await this.safeRegister("channel charity campaign start event", () => new ChannelCharityCampaignStartEvent(eventSub, bot).register());
        await this.safeRegister("channel charity campaign progress event", () => new ChannelCharityCampaignProgressEvent(eventSub, bot).register());
        await this.safeRegister("channel charity campaign stop event", () => new ChannelCharityCampaignStopEvent(eventSub, bot).register());
        await this.safeRegister("channel charity donation event", () => new ChannelCharityDonationEvent(eventSub, bot).register());
    }

    public getBot() {
        return this.bot;
    }

    public getMessageBot() {
        return this.messageBot;
    }

    public getEventSub() {
        return this.eventSub;
    }

    public async announce(message: string, color: TwitchMessageColor = "primary") {
        const primaryChannel = getPrimaryChannel();

        if (!this.bot) {
            logWarn("twitch announce skipped: control auth is not connected");
            return;
        }

        try {
            await this.bot.api.chat.sendAnnouncement(primaryChannel.id, {
                message,
                // @ts-ignore
                color,
            });
        } catch (error) {
            if (!this.warnTwitchNetworkError("twitch announce failed", error)) {
                logWarn("twitch announce failed:");
                logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
            }
        }
    }

    public async sendMessage(message: string, channelId?: string) {
        const primaryChannel = getPrimaryChannel();
        const broadcasterId = channelId ?? primaryChannel.id;

        await this.withMessageFallback("send message", async (bot, authName) => {
            const senderId = this.getAuthUserId(authName);
            if (!senderId) throw new Error(`missing ${authName} auth user id`);

            await bot.api.chat.sendChatMessageAsApp(senderId, broadcasterId, message);
        });
    }

    public async reply(message: string, replyParentMessageId: string, channelId?: string) {
        const primaryChannel = getPrimaryChannel();
        const broadcasterId = channelId ?? primaryChannel.id;

        await this.withMessageFallback("reply", async (bot, authName) => {
            const senderId = this.getAuthUserId(authName);
            if (!senderId) throw new Error(`missing ${authName} auth user id`);

            await bot.api.chat.sendChatMessageAsApp(senderId, broadcasterId, message, {
                replyParentMessageId,
            });
        });
    }

    public async sendDm(userId: string, message: string) {
        await this.withMessageFallback("send dm", async (bot, authName) => {
            const senderId = this.getAuthUserId(authName);
            if (!senderId) throw new Error(`missing ${authName} auth user id`);

            await bot.api.whispers.sendWhisper(senderId, userId, message);
        });
    }
}