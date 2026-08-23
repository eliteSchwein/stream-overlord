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
import {clearCommunitySubGiftState} from "../../helper/CommunitySubGiftHelper";

type TwitchMessageColor = "blue" | "green" | "orange" | "purple" | "primary";

export default class TwitchClient {
    protected auth: TwitchAuth;
    protected messageAuth?: TwitchAuth;

    protected bot?: Bot;
    protected messageBot?: Bot;

    protected controlAuthUserId?: string;
    protected messageAuthUserId?: string;

    protected eventSub?: EventSubWsListener;

    private controlAuthProvider?: any;
    private twitchConfig?: any;
    private hypeTrainLevel?: number;
    private connectGeneration = 0;

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
        const generation = ++this.connectGeneration;
        clearCommunitySubGiftState();

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

        this.twitchConfig = config;
        this.controlAuthProvider = authProvider;

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

        const bot = this.bot;

        // Chat is deliberately non-blocking. API/EventSub setup can complete
        // independently and the managed connection state is updated later.
        const chatConnectionPromise = this.waitForControlChatConnection();

        void chatConnectionPromise.then(chatConnected => {
            if (generation !== this.connectGeneration || this.bot !== bot) {
                return;
            }

            if (chatConnected) {
                setManagedConnection("twitch", {
                    enabled: true,
                    state: "connected",
                    connected: true,
                    message: "connected"
                });
                logSuccess("twitch chat connected");
                return;
            }

            logWarn("twitch chat connection timed out after 30000 ms");
            setManagedConnection("twitch", {
                enabled: true,
                state: "chat_timeout",
                connected: false,
                message: "Twitch API/EventSub is ready, but chat did not connect yet"
            });
        });

        // These do not depend on Twitch chat and can happen concurrently.
        const controlAuthUserPromise = this.loadStoredAuthUserId(this.auth, "control");
        const messageAuthPromise = this.tryMessageAuth(config);
        const primaryChannelPromise = loadPrimaryChannel(this);

        // Event registration needs getPrimaryChannel(), so only that lookup
        // must complete before EventSub registration begins.
        await primaryChannelPromise;

        logRegular("connect eventsub");

        this.eventSub = new EventSubWsListener({
            apiClient: bot.api,
            logger: { minLevel: "ERROR" }
        });

        // Twitch data loading and EventSub registration are independent after
        // the primary channel is known.
        await Promise.all([
            controlAuthUserPromise,
            updateTwitchData(bot),
            this.registerEvents(),
        ]);

        try {
            this.eventSub.start();
        } catch (error) {
            if (!this.warnTwitchNetworkError("failed to start eventsub", error)) {
                logWarn("failed to start eventsub");
                logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
            }
        }

        // Message auth is optional and must not hold the main Twitch startup
        // hostage. It continues in parallel if it is still initializing.
        void messageAuthPromise.catch(error => {
            if (!this.warnTwitchNetworkError("twitch message auth initialization failed", error)) {
                logWarn("twitch message auth initialization failed");
                logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
            }
        });

        if (generation !== this.connectGeneration || this.bot !== bot) {
            return;
        }

        setManagedConnection("twitch", {
            enabled: true,
            state: "api_ready",
            connected: false,
            message: "Twitch API/EventSub is ready, waiting for chat"
        });

        logSuccess("twitch api/eventsub is ready");
    }

    private registerBotEvents(bot: Bot) {
        new SubEvent(bot, this).register();
        new CommunitySubEvent(bot, this).register();
        new SubGiftEvent(bot, this).register();
        new RaidEvent(bot, this).register();
    }

    public async registerEvents() {
        if (!this.bot || !this.eventSub) {
            logWarn("cannot register Twitch events without an active Twitch connection");
            return;
        }

        const bot = this.bot;
        const eventSub = this.eventSub;

        this.registerBotEvents(bot);

        const affiliateOrPartnerPromise = this.isAffiliateOrPartner();

        const regularEventRegistrations = [
            ["follow event", () => new FollowEvent(eventSub, bot).register()],
            ["channel update event", () => new ChannelUpdateEvent(eventSub, bot).register()],
            ["user update event", () => new UserUpdateEvent(eventSub, bot).register()],
            ["stream online event", () => new StreamOnlineEvent(eventSub, bot).register()],
            ["stream offline event", () => new StreamOfflineEvent(eventSub, bot).register()],
            ["shield event", () => new ShieldEvent(eventSub, bot).register()],
            ["message delete event", () => new MessageDeleteEvent(eventSub, bot).register()],
            ["channel ban event", () => new ChannelBanEvent(eventSub, bot).register()],
            ["channel unban event", () => new ChannelUnbanEvent(eventSub, bot).register()],
            ["channel moderator add event", () => new ChannelModeratorAddEvent(eventSub, bot).register()],
            ["channel moderator remove event", () => new ChannelModeratorRemoveEvent(eventSub, bot).register()],
            ["channel vip add event", () => new ChannelVipAddEvent(eventSub, bot).register()],
            ["channel vip remove event", () => new ChannelVipRemoveEvent(eventSub, bot).register()],
            ["shared chat session event", () => new ChannelSharedChatSession(eventSub, bot).register()],
            ["shared chat session end event", () => new ChannelSharedChatSessionEnd(eventSub, bot).register()],
        ] as const;

        await Promise.all(
            regularEventRegistrations.map(([name, register]) =>
                this.safeRegister(name, register)
            )
        );

        const affiliateOrPartner = await affiliateOrPartnerPromise;

        if (!affiliateOrPartner) {
            logWarn("primary channel is not affiliate/partner - skipping monetization-related Twitch features");
            logWarn("Skipped: Channel Points, reward updates, Bits cheers, polls/predictions, hype trains, goals, ads and charity EventSub");
            return;
        }

        const monetizationEventRegistrations = [
            ["channel ad break begin event", () => new ChannelAdBreakBeginEvent(eventSub, bot).register()],
            ["channel points event", () => new ChannelPointsEvent(eventSub, bot).register()],
            ["channel point edit event", () => new ChannelPointEditEvent(eventSub, bot).register()],
            ["bits event", () => new CheerEvent(eventSub, bot).register()],
            ["poll prediction event", () => new PollPredictionEvent(eventSub, bot).register()],
            ["poll progress event", () => new PollProgressEvent(eventSub, bot).register()],
            ["prediction lock event", () => new PredictionLockEvent(eventSub, bot).register()],
            ["prediction progress event", () => new PredictionProgressEvent(eventSub, bot).register()],
            ["channel hype train begin event", () => new ChannelHypeTrainBeginEvent(eventSub, bot).register()],
            ["channel hype train progress event", () => new ChannelHypeTrainProgressEvent(eventSub, bot).register()],
            ["channel hype train end event", () => new ChannelHypeTrainEndEvent(eventSub, bot).register()],
            ["channel goal begin event", () => new ChannelGoalBeginEvent(eventSub, bot).register()],
            ["channel goal progress event", () => new ChannelGoalProgressEvent(eventSub, bot).register()],
            ["channel goal end event", () => new ChannelGoalEndEvent(eventSub, bot).register()],
            ["channel charity campaign start event", () => new ChannelCharityCampaignStartEvent(eventSub, bot).register()],
            ["channel charity campaign progress event", () => new ChannelCharityCampaignProgressEvent(eventSub, bot).register()],
            ["channel charity campaign stop event", () => new ChannelCharityCampaignStopEvent(eventSub, bot).register()],
            ["channel charity donation event", () => new ChannelCharityDonationEvent(eventSub, bot).register()],
        ] as const;

        await Promise.all(
            monetizationEventRegistrations.map(([name, register]) =>
                this.safeRegister(name, register)
            )
        );
    }

    public async reloadCommands() {
        logRegular("reload twitch command section");
        clearCommunitySubGiftState();

        if (!this.bot || !this.controlAuthProvider || !this.twitchConfig) {
            logWarn("cannot reload twitch commands without an active control bot");
            return;
        }

        const previousBot = this.bot;
        const commands = buildCommands(previousBot, this);

        const nextBot = new Bot({
            authProvider: this.controlAuthProvider,
            channels: this.twitchConfig.channels,
            chatClientOptions: null,
            commands,
        });

        this.bot = nextBot;
        this.registerBotEvents(nextBot);

        const connected = await this.waitForControlChatConnection(10_000);

        if (!connected) {
            logWarn("replacement twitch command bot failed to connect - keeping previous bot");

            try {
                nextBot.chat?.quit();
            } catch {
                // Ignore cleanup failure.
            }

            this.bot = previousBot;
            throw new Error("replacement twitch command bot failed to connect");
        }

        try {
            previousBot.chat?.quit();
        } catch (error) {
            logWarn("failed to disconnect previous twitch command bot");
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        }

        logRegular("twitch command section reloaded");
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

    public getHypeTrainLevel(): number | undefined {
        return this.hypeTrainLevel;
    }

    public setHypeTrainLevel(level: number | undefined) {
        this.hypeTrainLevel = level;
    }

    public resetHypeTrainLevel(level: number | undefined = undefined) {
        this.hypeTrainLevel = level;
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

    public async sendDm(user: string, message: string) {
        const userInput = String(user ?? "").trim().replace(/^@/, "");

        if (!userInput) {
            logWarn("twitch send dm skipped: user is empty");
            return;
        }

        const lookupBot = this.getOutgoingBots()[0]?.bot;

        if (!lookupBot) {
            logWarn("twitch send dm skipped: twitch is not connected");
            return;
        }

        try {
            const twitchUser = /^\d+$/.test(userInput)
                ? await lookupBot.api.users.getUserById(userInput)
                : await lookupBot.api.users.getUserByName(userInput);

            if (!twitchUser) {
                logWarn(`twitch send dm skipped: user not found (${userInput})`);
                return;
            }

            await this.withMessageFallback("send dm", async (bot, authName) => {
                const senderId = this.getAuthUserId(authName);
                if (!senderId) throw new Error(`missing ${authName} auth user id`);

                await bot.api.whispers.sendWhisper(senderId, twitchUser.id, message);
            });
        } catch (error) {
            if (!this.warnTwitchNetworkError("twitch send dm user lookup failed", error)) {
                logWarn(`twitch send dm user lookup failed for ${userInput}`);
                logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
            }
        }
    }
}