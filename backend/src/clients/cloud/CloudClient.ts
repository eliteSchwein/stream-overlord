import os from "node:os";
import {createHash} from "node:crypto";
import WebSocket from "ws";
import axios from "axios";
import * as packageConfig from "../../../../package.json";
import getGameInfo from "../../helper/GameHelper";
import {getMacros} from "../../helper/MacroHelper";
import {getInteractionQueue} from "../../helper/InteractionHelper";
import {getStatus as getMusicStatus} from "../../helper/MusicHelper";
import {getRemoteDashboardSnapshot} from "./RemoteDashboard";
import {getManagedConnections, setManagedConnection} from "../../helper/ConnectionHelper";
import {
    clearCloudIntegrationRegistration,
    getCloudIntegration,
    getIntegrationsSafe,
    setCloudIntegrationEnabled,
    setCloudIntegrationRegistration,
    loadIntegrationsCache,
} from "../../helper/IntegrationsHelper";
import {getConfig} from "../../helper/ConfigHelper";
import {getModeratorsForCloud} from "../twitch/helper/PermissionHelper";
import {logError, logNotice, logRegular, logSuccess, logWarn} from "../../helper/LogHelper";
import {triggerConfiguredEvent} from "../../helper/EventHelper";
import {getTwitchUserInfo} from "../../helper/TwitchUserInfoHelper";

const DEFAULT_CLOUD_URL = "https://cloud.streamding.dev";
const RECONNECT_DELAY = 5_000;
const MAX_RECONNECT_FAILURES = 5;
const HEARTBEAT_WATCHDOG_INTERVAL = 10_000;
const HEARTBEAT_STALE_AFTER = 30_000;
const CLOUD_BUFFERED_AMOUNT_LIMIT = 2 * 1024 * 1024;
const CLOUD_UPDATE_FLUSH_DELAY = 100;
const CLOUD_FORWARDED_METHODS = new Set([
    "notify_music_update",
    "notify_playlist_update",
    "notify_giveaway_update",
    "notify_interaction",
    "notify_interaction_queue",
    "notify_auto_macros_update",
    "notify_macro_update",
    "notify_channel_point_update",
    "notify_rotating_scene_update",
    "notify_rotating_scene_runtime_update",
    "notify_audio_update",
    "notify_audio_outputs_update",
    "notify_audio_presets_update",
    "notify_obs_scene_update",
    "notify_obs_scene_update_named",
    "notify_obs_audio_update",
    "notify_obs_audio_update_named",
    "notify_yolobox_update",
    "notify_connection_update",
    "notify_twitch_user_list",
]);

type PendingRegistration = {
    pairingId: string;
    status: string;
    expiresAt?: number;
    raw: any;
};

function firstString(...values: any[]) {
    for (const value of values) {
        if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
}

function trimTrailingSlash(value: string) {
    return value.replace(/\/+$/, "");
}

function env(name: string) {
    return String(process.env[name] ?? "").trim();
}

function unwrap(data: any) {
    return data?.data ?? data ?? {};
}

function normalizeCloudApiMethod(section: string, action: string, explicitMethod: string = "") {
    const aliases: Record<string, string> = {
        // Music
        "music.play": "music_play",
        "music.pause": "music_pause",
        "music.toggle": "music_toggle_pause",
        "music.toggle_pause": "music_toggle_pause",
        "music.next": "music_next",
        "music.prev": "music_back",
        "music.previous": "music_back",
        "music.back": "music_back",
        "music.volume": "music_volume",
        "music.volume_relative": "music_volume_relative",
        "music.shuffle": "music_shuffle",
        "music.loop": "music_loop",
        "music.songrequest_toggle": "music_songrequest_toggle",
        "music.play_song": "music_play_song",
        "music.status": "music_status",

        // Giveaway
        "giveaway.start": "start_giveaway",
        "giveaway.stop": "stop_giveaway",
        "giveaway.remove_user": "remove_giveaway_user",

        // Interactions
        "interaction.remove": "remove_interaction",
        "interactions.remove": "remove_interaction",
        "interaction.trigger": "trigger_interaction",
        "interactions.trigger": "trigger_interaction",

        // Auto macros / macros
        "auto_macro.toggle": "toggle_auto_macro",
        "auto_macros.toggle": "toggle_auto_macro",
        "macro.run": "trigger_macro",
        "macros.run": "trigger_macro",

        // Channel points
        "channel_point.toggle": "toggle_channel_point",
        "channel_points.toggle": "toggle_channel_point",

        // Rotating scenes
        "rotating_scene.start": "rotating_scene_start",
        "rotating_scene.stop": "rotating_scene_stop",
        "rotating_scene.status": "rotating_scene_status",
        "rotating_scene.runtime": "rotating_scene_runtime",

        // Audio
        "audio.volume": "set_audio_output_volume",
        "audio.output_volume": "set_audio_output_volume",
        "audio.mute": "set_audio_output_mute",
        "audio.output_mute": "set_audio_output_mute",
        "audio.preset": "audio_preset_apply",
        "audio.apply_preset": "audio_preset_apply",

        // OBS
        "obs.scene": "obs_set_scene",
        "obs.command": "obs_trigger_command",
        "obs.reload_browsers": "obs_reload_browsers",

        // Yolobox
        "yolobox.toggle": "yolobox_toggle",
        "yolobox.execute": "execute_yolobox",

        // Twitch moderation
        "twitch.timeout": "twitch_timeout",
        "twitch.ban": "twitch_ban",
        "twitch.unban": "twitch_unban",
        "twitch.warn": "twitch_warn",
        "twitch.clear_chat": "twitch_clear_chat",
        "twitch.delete_message": "twitch_delete_message",
        "twitch.moderator": "twitch_moderator",
        "twitch.vip": "twitch_vip",
        "twitch.shield_mode": "twitch_shield_mode",
        "twitch.slow_chat": "twitch_slow_chat",
        "twitch.emote_only": "twitch_emote_only",
        "twitch.followers_only": "twitch_followers_only",
        "twitch.subscribers_only": "twitch_subscribers_only",
        "twitch.unique_chat": "twitch_unique_chat",
        "twitch.user_info": "twitch_user_info",

        "twitch.moderation.timeout": "twitch_timeout",
        "twitch.moderation.ban": "twitch_ban",
        "twitch.moderation.unban": "twitch_unban",
        "twitch.moderation.warn": "twitch_warn",
        "twitch.moderation.clear_chat": "twitch_clear_chat",
        "twitch.moderation.delete_message": "twitch_delete_message",
        "twitch.moderation.moderator": "twitch_moderator",
        "twitch.moderation.vip": "twitch_vip",
        "twitch.moderation.shield_mode": "twitch_shield_mode",

        "twitch.chat.slow": "twitch_slow_chat",
        "twitch.chat.slow_chat": "twitch_slow_chat",
        "twitch.chat.emote_only": "twitch_emote_only",
        "twitch.chat.followers_only": "twitch_followers_only",
        "twitch.chat.subscribers_only": "twitch_subscribers_only",
        "twitch.chat.unique": "twitch_unique_chat",
        "twitch.chat.unique_chat": "twitch_unique_chat",

        // Compatibility aliases
        music_prev: "music_back",
        music_previous: "music_back",
    };

    const directMethod = String(explicitMethod ?? "").trim().toLowerCase();
    if (directMethod) return aliases[directMethod] ?? directMethod;

    const cleanSection = String(section ?? "").trim().toLowerCase();
    const cleanAction = String(action ?? "").trim().toLowerCase();
    if (!cleanAction) return "";

    // Cloud may send a qualified action such as `macro.run` directly.
    if (aliases[cleanAction]) return aliases[cleanAction];

    const methods: Record<string, Record<string, string>> = {
        music: {
            play: "music_play",
            pause: "music_pause",
            toggle: "music_toggle_pause",
            toggle_pause: "music_toggle_pause",
            next: "music_next",
            previous: "music_back",
            back: "music_back",
            volume: "music_volume",
            shuffle: "music_shuffle",
            loop: "music_loop",
            songrequest_toggle: "music_songrequest_toggle",
            song_requests_toggle: "music_songrequest_toggle",
            play_song: "music_play_song",
        },
        giveaway: {
            start: "start_giveaway",
            stop: "stop_giveaway",
            remove_user: "remove_giveaway_user",
        },
        interactions: {
            remove: "remove_interaction",
            trigger: "trigger_interaction",
        },
        interaction: {
            remove: "remove_interaction",
            trigger: "trigger_interaction",
        },
        auto_macros: {toggle: "toggle_auto_macro"},
        auto_macro: {toggle: "toggle_auto_macro"},
        macros: {run: "trigger_macro"},
        macro: {run: "trigger_macro"},
        channel_points: {toggle: "toggle_channel_point"},
        channel_point: {toggle: "toggle_channel_point"},
        rotating_scene: {start: "rotating_scene_start", stop: "rotating_scene_stop"},
        rotating_scenes: {start: "rotating_scene_start", stop: "rotating_scene_stop"},
        audio: {
            volume: "set_audio_output_volume",
            output_volume: "set_audio_output_volume",
            mute: "set_audio_output_mute",
            output_mute: "set_audio_output_mute",
            preset: "audio_preset_apply",
            apply_preset: "audio_preset_apply",
        },
        obs: {scene: "obs_set_scene", command: "obs_trigger_command", reload_browsers: "obs_reload_browsers"},
        yolobox: {toggle: "yolobox_toggle", execute: "execute_yolobox"},

        twitch: {
            timeout: "twitch_timeout",
            ban: "twitch_ban",
            unban: "twitch_unban",
            warn: "twitch_warn",
            clear_chat: "twitch_clear_chat",
            delete_message: "twitch_delete_message",
            moderator: "twitch_moderator",
            vip: "twitch_vip",
            shield_mode: "twitch_shield_mode",
            slow: "twitch_slow_chat",
            slow_chat: "twitch_slow_chat",
            emote_only: "twitch_emote_only",
            followers_only: "twitch_followers_only",
            subscribers_only: "twitch_subscribers_only",
            unique: "twitch_unique_chat",
            unique_chat: "twitch_unique_chat",
            user_info: "twitch_user_info",
        },

        twitch_moderation: {
            timeout: "twitch_timeout",
            ban: "twitch_ban",
            unban: "twitch_unban",
            warn: "twitch_warn",
            clear_chat: "twitch_clear_chat",
            delete_message: "twitch_delete_message",
            moderator: "twitch_moderator",
            vip: "twitch_vip",
            shield_mode: "twitch_shield_mode",
        },

        twitch_chat: {
            slow: "twitch_slow_chat",
            slow_chat: "twitch_slow_chat",
            emote_only: "twitch_emote_only",
            followers_only: "twitch_followers_only",
            subscribers_only: "twitch_subscribers_only",
            unique: "twitch_unique_chat",
            unique_chat: "twitch_unique_chat",
        },
    };

    // If the cloud already sends a real websocket method, use it unchanged.
    if (cleanAction.includes("_") && !methods[cleanSection]?.[cleanAction]) return cleanAction;
    return methods[cleanSection]?.[cleanAction] ?? cleanAction;
}

function normalizeCloudApiParams(method: string, payload: any) {
    const params = payload && typeof payload === "object" && !Array.isArray(payload)
        ? {...payload}
        : {};

    if (method === "trigger_macro" && !params.macro) {
        params.macro = firstString(params.id, params.name);
    }
    if (method === "toggle_auto_macro" && params.enable === undefined && params.enabled !== undefined) {
        params.enable = Boolean(params.enabled);
    }
    if (method === "set_audio_output_mute" && params.muted === undefined && params.enabled !== undefined) {
        params.muted = Boolean(params.enabled);
    }

    if (
        method.startsWith("twitch_")
        && params.user === undefined
    ) {
        params.user = firstString(
            params.login,
            params.user_login,
            params.username,
            params.user_id,
            params.target,
        );
    }

    if (
        method === "twitch_delete_message"
        && params.message_id === undefined
    ) {
        params.message_id = firstString(
            params.messageId,
            params.id,
        );
    }

    if (
        ["twitch_moderator", "twitch_vip"].includes(method)
        && params.action === undefined
        && params.enabled !== undefined
    ) {
        params.action =
            Boolean(params.enabled)
                ? "add"
                : "remove";
    }

    return params;
}

function isCloudSuppressedUpdate(method: string) {
    return String(method ?? "").toLowerCase().includes("cava");
}

function stripCloudSuppressedData(value: any): any {
    if (Array.isArray(value)) return value.map(stripCloudSuppressedData);
    if (!value || typeof value !== "object") return value;

    const result: Record<string, any> = {};
    for (const [key, entry] of Object.entries(value)) {
        if (key.toLowerCase().includes("cava")) continue;
        result[key] = stripCloudSuppressedData(entry);
    }
    return result;
}

function isCloudRecord(value: any): value is Record<string, any> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneCloudValue(value: any): any {
    if (Array.isArray(value)) return value.map(cloneCloudValue);
    if (!isCloudRecord(value)) return value;

    const result: Record<string, any> = {};
    for (const [key, entry] of Object.entries(value)) {
        result[key] = cloneCloudValue(entry);
    }
    return result;
}

/**
 * Build a JSON merge-style delta. Objects are diffed recursively so a notify
 * with one changed field only forwards that field. Arrays are intentionally
 * atomic: if an array changes, the latest complete array is sent. Removed
 * object keys are represented as null so the cloud can remove them while
 * merging the delta into its existing state.
 */
function createCloudDelta(previous: any, next: any): any | undefined {
    if (Object.is(previous, next)) return undefined;

    if (Array.isArray(previous) || Array.isArray(next)) {
        try {
            if (JSON.stringify(previous) === JSON.stringify(next)) return undefined;
        } catch {}
        return cloneCloudValue(next);
    }

    if (isCloudRecord(previous) && isCloudRecord(next)) {
        const delta: Record<string, any> = {};
        let changed = false;

        for (const key of Object.keys(next)) {
            const childDelta = createCloudDelta(previous[key], next[key]);
            if (childDelta === undefined) continue;
            delta[key] = childDelta;
            changed = true;
        }

        for (const key of Object.keys(previous)) {
            if (Object.prototype.hasOwnProperty.call(next, key)) continue;
            delta[key] = null;
            changed = true;
        }

        return changed ? delta : undefined;
    }

    return cloneCloudValue(next);
}

export default class CloudClient {
    private socket?: WebSocket;
    private reconnectTimer?: NodeJS.Timeout;
    private pendingRegistration?: PendingRegistration;
    private manualDisconnect = false;
    private lastState: Record<string, any> = {};
    private lastSentState: Record<string, any> = {};
    private lastUpdateSignatures = new Map<string, string>();
    private pendingUpdates = new Map<string, {data: any; fullState: any}>();
    private updateFlushTimer?: NodeJS.Timeout;
    private registrationVerifyInFlight = false;
    private reconnectFailures = 0;
    private heartbeatWatchdog?: NodeJS.Timeout;
    private lastCloudActivityAt = 0;

    public getConfig() {
        const config = getConfig(/cloud/g)[0] ?? {};
        const baseUrl = trimTrailingSlash(firstString(
            env("STREAMBOT_CLOUD_URL"),
            config.url,
            config.base_url,
            DEFAULT_CLOUD_URL,
        ));

        const startRegistrationUrl = firstString(
            env("STREAMBOT_CLOUD_REGISTRATION_START_URL"),
            config.registration_start_url,
            `${baseUrl}/api/v1/streambot/registration/start`,
        );

        const verifyRegistrationUrl = firstString(
            env("STREAMBOT_CLOUD_REGISTRATION_VERIFY_URL"),
            config.registration_verify_url,
            `${baseUrl}/api/v1/streambot/registration/verify`,
        );

        let websocketUrl = firstString(
            env("STREAMBOT_CLOUD_WEBSOCKET_URL"),
            config.websocket_url,
        );

        if (!websocketUrl) {
            const url = new URL(baseUrl);
            url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
            url.pathname = "/ws/streambot";
            url.search = "";
            url.hash = "";
            websocketUrl = url.toString();
        }

        return {
            baseUrl,
            startRegistrationUrl,
            verifyRegistrationUrl,
            websocketUrl,
        };
    }

    public getState() {
        const connection = getManagedConnections().cloud ?? {
            enabled: Boolean(getCloudIntegration().enabled),
            connected: false,
            state: "disconnected",
            message: "disconnected",
        };

        return {
            ...getIntegrationsSafe().cloud,
            connection,
            pending_registration: Boolean(this.pendingRegistration),
            pairing_id: this.pendingRegistration?.pairingId ?? "",
            pin_required: Boolean(this.pendingRegistration),
            registration_status: this.pendingRegistration?.status ?? "",
            expires_at: this.pendingRegistration?.expiresAt ?? null,
        };
    }

    public async startRegistration(name?: string) {
        const config = this.getConfig();
        const instanceName = String(name ?? "").trim() || os.hostname();

        const twitchLogin = firstString(
            loadIntegrationsCache()?.twitch?.control?.login,
            loadIntegrationsCache()?.twitch?.control?.user_login,
        );

        if (!twitchLogin) {
            throw new Error("cloud registration requires a configured Twitch control login");
        }

        const response = await axios.post(
            config.startRegistrationUrl,
            {
                name: instanceName,
                twitch_login: twitchLogin,
            },
            {
                headers: {"Content-Type": "application/json"},
                timeout: 10_000,
                validateStatus: () => true,
            },
        );

        if (response.status < 200 || response.status >= 300) {
            const root = unwrap(response.data);
            const message = firstString(root?.message, root?.error);
            throw new Error(message || `cloud registration start failed (${response.status})`);
        }

        const root = unwrap(response.data);
        const pairingId = firstString(root.pairing_id, root.pairingId, root.registration_id, root.registrationId, root.id);
        if (!pairingId) {
            throw new Error("cloud registration start response is missing pairing_id");
        }

        const expiresIn = Number(root.expires_in ?? root.expiresIn ?? 600);
        this.pendingRegistration = {
            pairingId,
            status: "pin_required",
            expiresAt: Number.isFinite(expiresIn) && expiresIn > 0 ? Date.now() + expiresIn * 1000 : undefined,
            raw: root,
        };

        setManagedConnection("cloud", {
            enabled: true,
            connected: false,
            state: "auth_required",
            message: "Cloud PIN verification required",
        });

        logRegular(`cloud registration started: pairing_id=${pairingId}`);

        return {
            status: "pin_required",
            pairing_id: pairingId,
            pin_required: true,
            expires_in: Number.isFinite(expiresIn) ? expiresIn : 600,
        };
    }

    public async verifyRegistration(pin: string) {
        if (this.registrationVerifyInFlight) {
            return {
                status: "verifying",
                pairing_id: this.pendingRegistration?.pairingId ?? "",
                pin_required: true,
            };
        }

        const pending = this.pendingRegistration;
        if (!pending) throw new Error("no cloud registration is pending");

        const cleanPin = String(pin ?? "").trim();
        if (!/^\d{6}$/.test(cleanPin)) {
            throw new Error("cloud registration PIN must contain exactly 6 digits");
        }

        if (pending.expiresAt && Date.now() >= pending.expiresAt) {
            pending.status = "expired";
            throw new Error("cloud registration PIN has expired");
        }

        this.registrationVerifyInFlight = true;
        pending.status = "verifying";

        try {
            const response = await axios.post(
                this.getConfig().verifyRegistrationUrl,
                {
                    pairing_id: pending.pairingId,
                    pin: cleanPin,
                },
                {
                    headers: {"Content-Type": "application/json"},
                    timeout: 10_000,
                    validateStatus: () => true,
                },
            );

            const root = unwrap(response.data);

            if (response.status < 200 || response.status >= 300) {
                pending.status = response.status === 410 ? "expired" : "pin_required";
                const message = firstString(root?.message, root?.error);
                throw new Error(message || `cloud registration verification failed (${response.status})`);
            }

            const instance = root.instance ?? root.streambot ?? root;
            const token = firstString(
                root.instance_token,
                root.instanceToken,
                root.token,
                root.access_token,
                instance.instance_token,
                instance.instanceToken,
                instance.token,
            );

            if (!token) {
                pending.status = "pin_required";
                throw new Error("cloud registration verification response is missing instance token");
            }

            setCloudIntegrationRegistration({
                enabled: true,
                instance_id: firstString(root.instance_id, root.instanceId, instance.id, instance.instance_id),
                instance_token: token,
                streamer_id: firstString(root.streamer_id, root.streamerId, root.streamer?.id, instance.streamer_id),
                name: firstString(instance.name, root.name, os.hostname()),
                websocket_url: firstString(root.websocket_url, root.websocketUrl, instance.websocket_url),
            });

            this.pendingRegistration = undefined;
            await this.connect();

            logSuccess("cloud registration PIN verified");
            return {
                status: "connected",
                pin_required: false,
                cloud: getIntegrationsSafe().cloud,
            };
        } finally {
            this.registrationVerifyInFlight = false;
        }
    }

    /**
     * Kept only so older Commander builds fail with a useful message instead of
     * silently using the superseded claim flow.
     */
    public async claimRegistration() {
        if (!this.pendingRegistration) throw new Error("no cloud registration is pending");
        throw new Error("cloud registration now requires PIN verification; use cloud_registration_verify");
    }

    public async setEnabled(enabled: boolean) {
        setCloudIntegrationEnabled(enabled);
        if (!enabled) this.disconnect();
        else await this.connect();
        return this.getState();
    }

    public async removeRegistration() {
        this.disconnect();
        this.registrationVerifyInFlight = false;
        this.pendingRegistration = undefined;
        clearCloudIntegrationRegistration();
        return this.getState();
    }

    public async connect(resetReconnectFailures: boolean = true) {
        this.clearReconnect();
        this.manualDisconnect = false;

        if (resetReconnectFailures) {
            this.reconnectFailures = 0;
        }

        const integration = getCloudIntegration();
        if (!integration.enabled) {
            setManagedConnection("cloud", {
                enabled: false,
                connected: false,
                state: "disconnected",
                message: "Cloud integration disabled",
            });
            return;
        }

        if (!integration.instance_token) {
            setManagedConnection("cloud", {
                enabled: true,
                connected: false,
                state: "auth_required",
                message: "Cloud registration required",
            });
            return;
        }

        this.closeSocket();
        setManagedConnection("cloud", {
            enabled: true,
            connected: false,
            state: "connecting",
            message: "connecting",
        });

        const configuredUrl = firstString(integration.websocket_url, this.getConfig().websocketUrl);
        const url = new URL(configuredUrl);
        url.searchParams.set("token", integration.instance_token);

        logRegular(`connect cloud integration: ${url.origin}${url.pathname}`);

        const socket = new WebSocket(url.toString());
        this.socket = socket;

        socket.on("open", () => {
            if (this.socket !== socket) return;
            this.reconnectFailures = 0;
            this.lastCloudActivityAt = Date.now();
            this.startHeartbeatWatchdog(socket);
            setManagedConnection("cloud", {
                enabled: true,
                connected: true,
                state: "connected",
                message: "connected",
            });
            logSuccess("cloud integration connected");
            this.lastUpdateSignatures.clear();
            this.lastSentState = {};
            this.pendingUpdates.clear();
            this.syncModerators();
            this.sendSnapshot();
        });

        socket.on("message", raw => {
            this.markCloudActivity();
            void this.handleMessage(raw.toString()).catch(error => {
                logWarn("cloud message failed");
                logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
            });
        });

        socket.on("ping", () => {
            // ws automatically replies with pong. Tracking the ping keeps the local
            // watchdog aligned with the cloud heartbeat without sending duplicate pongs.
            this.markCloudActivity();
        });

        socket.on("pong", () => {
            this.markCloudActivity();
        });

        socket.on("error", error => {
            if (this.socket !== socket) return;
            logWarn("cloud integration websocket error");
            logWarn(error instanceof Error ? error.message : String(error));
        });

        socket.on("close", (code, reason) => {
            if (this.socket === socket) this.socket = undefined;
            this.stopHeartbeatWatchdog();
            this.clearUpdateFlush();
            setManagedConnection("cloud", {
                enabled: Boolean(getCloudIntegration().enabled),
                connected: false,
                state: "disconnected",
                message: `disconnected (${code}${reason?.length ? `: ${reason.toString()}` : ""})`,
            });

            if (!this.manualDisconnect && getCloudIntegration().enabled) {
                this.reconnectFailures += 1;

                if (this.reconnectFailures >= MAX_RECONNECT_FAILURES) {
                    setManagedConnection("cloud", {
                        enabled: true,
                        connected: false,
                        state: "error",
                        message: `reconnect failed ${this.reconnectFailures}/${MAX_RECONNECT_FAILURES}; stopped`,
                    });
                    logWarn(`cloud reconnect failed ${this.reconnectFailures}/${MAX_RECONNECT_FAILURES}; stopping reconnect attempts`);
                    return;
                }

                logNotice(`cloud reconnect ${this.reconnectFailures}/${MAX_RECONNECT_FAILURES}`);
                this.reconnectTimer = setTimeout(() => {
                    void this.connect(false).catch(error => {
                        logWarn("cloud reconnect failed");
                        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
                    });
                }, RECONNECT_DELAY);
            }
        });
    }

    public disconnect() {
        this.manualDisconnect = true;
        this.stopHeartbeatWatchdog();
        this.reconnectFailures = 0;
        this.clearReconnect();
        this.clearUpdateFlush();
        this.pendingUpdates.clear();
        this.closeSocket();
        setManagedConnection("cloud", {
            enabled: Boolean(getCloudIntegration().enabled),
            connected: false,
            state: "disconnected",
            message: "disconnected",
        });
    }

    public syncModerators() {
        this.send({type: "moderators", moderators: getModeratorsForCloud()});
    }

    public handleLocalUpdate(method: string, data: any) {
        if (!method.startsWith("notify_")) return;
        if (!CLOUD_FORWARDED_METHODS.has(method)) return;

        // CAVA stays local-only and must never occupy cloud state/bandwidth.
        if (isCloudSuppressedUpdate(method)) {
            delete this.lastState[method];
            delete this.lastSentState[method];
            this.lastUpdateSignatures.delete(method);
            this.pendingUpdates.delete(method);
            return;
        }

        const cleanData = stripCloudSuppressedData(data);
        this.lastState[method] = cloneCloudValue(cleanData);

        // The first cloud connection gets a complete snapshot. After that, compare
        // every notify against the last state that was actually delivered to cloud
        // and forward only changed keys. If this notify was not part of the initial
        // snapshot yet, its first update is intentionally sent in full.
        const hasBaseline = Object.prototype.hasOwnProperty.call(this.lastSentState, method);
        const delta = hasBaseline
            ? createCloudDelta(this.lastSentState[method], cleanData)
            : cloneCloudValue(cleanData);

        if (delta === undefined) return;

        // Keep only the newest cumulative delta per method while the cloud socket is
        // congested. fullState is committed only after the delta was really sent.
        this.pendingUpdates.set(method, {
            data: delta,
            fullState: cloneCloudValue(cleanData),
        });
        this.flushPendingUpdates();
    }

    private flushPendingUpdates() {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

        if (this.socket.bufferedAmount > CLOUD_BUFFERED_AMOUNT_LIMIT) {
            this.scheduleUpdateFlush();
            return;
        }

        for (const [method, pending] of Array.from(this.pendingUpdates.entries())) {
            if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
            if (this.socket.bufferedAmount > CLOUD_BUFFERED_AMOUNT_LIMIT) {
                this.scheduleUpdateFlush();
                return;
            }

            if (this.send({type: "update", method, data: pending.data, partial: true})) {
                this.lastSentState[method] = cloneCloudValue(pending.fullState);
                try {
                    this.lastUpdateSignatures.set(
                        method,
                        createHash("sha1").update(JSON.stringify(pending.fullState)).digest("hex"),
                    );
                } catch {}
                this.pendingUpdates.delete(method);
            } else {
                this.scheduleUpdateFlush();
                return;
            }
        }
    }

    private scheduleUpdateFlush() {
        if (this.updateFlushTimer) return;
        this.updateFlushTimer = setTimeout(() => {
            this.updateFlushTimer = undefined;
            this.flushPendingUpdates();
        }, CLOUD_UPDATE_FLUSH_DELAY);
        this.updateFlushTimer.unref?.();
    }

    private clearUpdateFlush() {
        if (!this.updateFlushTimer) return;
        clearTimeout(this.updateFlushTimer);
        this.updateFlushTimer = undefined;
    }

    public sendSnapshot() {
        try {
            const dashboard = getRemoteDashboardSnapshot();
            const status = {
                ...this.lastState,
                game: getGameInfo(),
                music: getMusicStatus(),
                connections: getManagedConnections(),
            };

            const payload = stripCloudSuppressedData({
                type: "snapshot",
                data: {
                    macros: dashboard.macros ?? getMacros(),
                    interactions: dashboard.interactions ?? getInteractionQueue(),
                    status,
                    dashboard,
                },
            });

            if (this.send(payload)) {
                // A snapshot establishes a fresh baseline for this websocket. Every
                // later notify is sent as a partial-key delta against this exact state.
                this.lastSentState = {};
                for (const [method, data] of Object.entries(this.lastState)) {
                    this.lastSentState[method] = cloneCloudValue(data);
                    try {
                        this.lastUpdateSignatures.set(
                            method,
                            createHash("sha1").update(JSON.stringify(data)).digest("hex"),
                        );
                    } catch {}
                    this.pendingUpdates.delete(method);
                }
            }
        } catch (error: any) {
            logError("failed to build/send cloud snapshot");
            logError(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        }
    }

    private send(data: any) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
        if (this.socket.bufferedAmount > CLOUD_BUFFERED_AMOUNT_LIMIT) return false;
        try {
            this.socket.send(JSON.stringify(data));
            return true;
        } catch (error) {
            logError("failed to send cloud websocket message");
            logError(JSON.stringify(error, Object.getOwnPropertyNames(error)));
            return false;
        }
    }

    private async handleMessage(raw: string) {
        let message: any;
        try {
            message = JSON.parse(raw);
        } catch {
            return;
        }

        const topType = String(message?.type ?? "").trim().toLowerCase();

        if (topType === "notify_kofi_event") {
            await this.handleKofiEvent(message);
            return;
        }

        if (["snapshot_request", "snapshot.request"].includes(topType)) {
            this.sendSnapshot();
            return;
        }

        const nested = message?.data && typeof message.data === "object" && !Array.isArray(message.data)
            ? message.data
            : null;

        const requestId = firstString(
            message?.request_id,
            message?.requestId,
            nested?.request_id,
            nested?.requestId,
            message?.id,
        );
        const requestedBy = message?.requested_by ?? message?.requestedBy ?? nested?.requested_by ?? nested?.requestedBy;
        const requestedByLogin = firstString(requestedBy?.login, requestedBy?.display_name, requestedBy?.twitch_user_id);

        const section = firstString(message?.section, nested?.section);
        const action = firstString(message?.action, message?.command, nested?.action, nested?.command);
        const explicitMethod = firstString(message?.method, nested?.method);
        const method = normalizeCloudApiMethod(section, action, explicitMethod);

        if (!method) return;

        let rawParams: any = {};
        if (message?.params && typeof message.params === "object") rawParams = message.params;
        else if (message?.payload && typeof message.payload === "object") rawParams = message.payload;
        else if (nested?.params && typeof nested.params === "object") rawParams = nested.params;
        else if (nested?.payload && typeof nested.payload === "object") rawParams = nested.payload;

        const params = normalizeCloudApiParams(method, rawParams);

        logRegular(`cloud API request: ${method}${requestedByLogin ? ` by ${requestedByLogin}` : ""}`);

        try {
            const {default: getWebsocketServer} = await import("../../App");
            const result = await getWebsocketServer().dispatchApiMethod(method, params);

            logSuccess(`cloud API completed: ${method}${requestedByLogin ? ` by ${requestedByLogin}` : ""}`);
            this.send({
                type: "action_result",
                request_id: requestId,
                success: true,
                data: result ?? {status: "okay"},
            });

            // State changes caused by the action are forwarded through the normal
            // notify_* path as deltas; do not resend the entire cloud snapshot.
        } catch (error: any) {
            const errorMessage = error?.message ?? String(error);
            logWarn(`cloud API failed: ${method} - ${errorMessage}`);
            this.send({
                type: "action_result",
                request_id: requestId,
                success: false,
                error: errorMessage,
            });
        }
    }


    private async handleKofiEvent(message: any) {
        const data = message?.data && typeof message.data === "object" && !Array.isArray(message.data)
            ? message.data
            : {};

        const eventType = firstString(data.type, "Ko-fi");
        const fromName = firstString(data.from_name, data.fromName, data.name, "anonymous");
        const amount = firstString(data.amount);
        const currency = firstString(data.currency);

        logRegular(
            `Ko-fi event: ${eventType} from ${fromName}` +
            (amount ? ` (${amount}${currency ? ` ${currency}` : ""})` : ""),
        );

        const eventUuid = `event_kofi_${firstString(data.message_id, data.messageId, data.kofi_transaction_id, data.transaction_id) || Date.now()}`;
        const eventPayload = {
            ...data,
            event: data,
            eventUuid,
            streamer_id: firstString(message?.streamer_id, message?.streamerId),
            received_at: firstString(message?.received_at, message?.receivedAt),
        };
        const eventLabel = `Ko-fi: ${eventType}${fromName ? ` from ${fromName}` : ""}`;

        // Keep the generic Ko-fi event for backwards compatibility / catch-all use.
        await triggerConfiguredEvent("event_kofi", eventPayload, eventLabel);

        const normalizedType = eventType.trim().toLowerCase().replace(/[\s_-]+/g, " ");
        const typedEvent = ({
            donation: "event_kofi_donation",
            subscription: "event_kofi_subscription",
            "shop order": "event_kofi_shop_order",
            commission: "event_kofi_commission",
        } as Record<string, string>)[normalizedType];

        if (typedEvent) {
            await triggerConfiguredEvent(typedEvent, eventPayload, eventLabel);
        }
    }

    private markCloudActivity() {
        this.lastCloudActivityAt = Date.now();
    }

    private startHeartbeatWatchdog(socket: WebSocket) {
        this.stopHeartbeatWatchdog();
        this.heartbeatWatchdog = setInterval(() => {
            if (this.socket !== socket || socket.readyState !== WebSocket.OPEN) return;

            const inactiveFor = Date.now() - this.lastCloudActivityAt;
            if (inactiveFor <= HEARTBEAT_STALE_AFTER) return;

            logWarn(`cloud websocket heartbeat stale for ${Math.round(inactiveFor / 1000)}s; reconnecting`);
            // terminate() is intentional here: for a half-open TCP connection close()
            // can wait indefinitely and would not trigger the normal reconnect path.
            socket.terminate();
        }, HEARTBEAT_WATCHDOG_INTERVAL);
        this.heartbeatWatchdog.unref?.();
    }

    private stopHeartbeatWatchdog() {
        if (!this.heartbeatWatchdog) return;
        clearInterval(this.heartbeatWatchdog);
        this.heartbeatWatchdog = undefined;
    }

    private closeSocket() {
        this.stopHeartbeatWatchdog();
        const socket = this.socket;
        this.socket = undefined;
        if (!socket) return;
        try {
            socket.removeAllListeners();
            socket.close();
        } catch {}
    }

    private clearReconnect() {
        if (!this.reconnectTimer) return;
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = undefined;
    }

    async getTwitchUserInfo(user: string): Promise<any> {
        const result =
            await getTwitchUserInfo(user);

        if (!result) {
            throw new Error("user not found");
        }

        return result;
    }
}
