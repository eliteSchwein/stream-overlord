import os from "node:os";
import {Worker} from "node:worker_threads";
import axios from "axios";
import * as packageConfig from "../../../../package.json";
import getGameInfo from "../../helper/GameHelper";
import {getCloudMacros} from "../../helper/MacroHelper";
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
import {resolveWorkerScript} from "../../helper/WorkerHelper";
import {firstString, trimTrailingSlash, env, unwrap} from "./CloudShared";
import {CloudSnapshotExtra, CloudWorkerToMainMessage, MainToCloudWorkerMessage} from "./worker/CloudWorkerProtocol";

const DEFAULT_CLOUD_URL = "https://cloud.streamding.dev";
const RECONNECT_DELAY = 5_000;
const MAX_RECONNECT_FAILURES = 5;
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
    "notify_song_request_update",
    "notify_twitch_user_list",
]);

type PendingRegistration = {
    pairingId: string;
    status: string;
    expiresAt?: number;
    raw: any;
};

/**
 * Cloud integration. The WebSocket and all per-update work (delta, JSON,
 * hashing, back-pressure) run in the `cloud` worker thread (CloudWorker).
 * This class keeps everything that needs the rest of the app: registration,
 * connection status, the reconnect policy, snapshots, Ko-fi events and
 * running API actions requested by the cloud.
 */
export default class CloudClient {
    private worker?: Worker;
    // True between a connect request and the worker reporting the socket closed.
    private socketActive = false;
    // Latest local state per method while no worker is running, so the first
    // snapshot after (re)starting the worker is complete.
    private bufferedLocalState = new Map<string, {data: any; macros?: any}>();
    private reconnectTimer?: NodeJS.Timeout;
    private pendingRegistration?: PendingRegistration;
    private manualDisconnect = false;
    private registrationVerifyInFlight = false;
    private reconnectFailures = 0;

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

        // The worker closes any previous socket before opening the new one.
        this.socketActive = true;
        this.post({type: "connect", url: url.toString()});
    }

    public disconnect() {
        this.manualDisconnect = true;
        this.reconnectFailures = 0;
        this.clearReconnect();
        this.socketActive = false;
        if (this.worker) this.post({type: "disconnect"});
        setManagedConnection("cloud", {
            enabled: Boolean(getCloudIntegration().enabled),
            connected: false,
            state: "disconnected",
            message: "disconnected",
        });
    }

    public syncModerators() {
        if (!this.worker) return;
        this.post({type: "send", payload: {type: "moderators", moderators: getModeratorsForCloud()}});
    }

    public handleLocalUpdate(method: string, data: any) {
        if (!method.startsWith("notify_")) return;
        if (!CLOUD_FORWARDED_METHODS.has(method)) return;

        // Local macro notifications contain every macro because the local UI
        // must still see/edit hidden entries. Cloud receives a dedicated
        // projection so hide_from_cloud=true macros never enter cloud state,
        // snapshots or delta updates.
        const macros = method === "notify_macro_update" ? getCloudMacros() : undefined;

        if (!this.worker && !getCloudIntegration().enabled) {
            // No cloud thread needed yet; remember the newest state only.
            this.bufferedLocalState.set(method, {data, macros});
            return;
        }

        this.post({type: "update", method, data, macros});
    }

    public sendSnapshot() {
        if (!this.worker) return;

        try {
            const dashboard = getRemoteDashboardSnapshot();
            const extra: CloudSnapshotExtra = {
                macros: dashboard.macros ?? getCloudMacros(),
                interactions: dashboard.interactions ?? getInteractionQueue(),
                dashboard,
                game: getGameInfo(),
                music: getMusicStatus(),
                connections: getManagedConnections(),
            };

            this.post({type: "snapshot", extra});
        } catch (error: any) {
            logError("failed to build/send cloud snapshot");
            logError(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        }
    }

    // --- worker -----------------------------------------------------------

    private ensureWorker() {
        if (this.worker) return this.worker;

        // The name becomes the OS thread name (visible in `top -H` / `ps -T`).
        const worker = new Worker(resolveWorkerScript("cloud-worker.js"), {name: "cloud"});
        this.worker = worker;

        worker.on("message", (message: CloudWorkerToMainMessage) => {
            if (this.worker !== worker) return;
            void this.handleWorkerMessage(message).catch(error => {
                logWarn("cloud message failed");
                logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
            });
        });

        worker.on("error", error => {
            logWarn(`cloud worker error: ${(error as any)?.message ?? error}`);
        });

        worker.on("exit", code => {
            if (this.worker !== worker) return;
            this.worker = undefined;
            logWarn(`cloud worker exited (code=${code})`);

            // Treat it like a dropped socket so the normal reconnect path runs
            // (which starts a fresh worker).
            if (this.socketActive) {
                this.handleSocketClose(1006, "cloud worker exited");
            }
        });

        // Replay state collected while no worker was running.
        for (const [method, entry] of this.bufferedLocalState) {
            this.postTo(worker, {type: "update", method, data: entry.data, macros: entry.macros});
        }
        this.bufferedLocalState.clear();

        return worker;
    }

    private post(message: MainToCloudWorkerMessage) {
        this.postTo(this.ensureWorker(), message);
    }

    private postTo(worker: Worker, message: MainToCloudWorkerMessage) {
        try {
            worker.postMessage(message);
        } catch (error) {
            // Values that cannot be structured-cloned (e.g. functions) would be
            // dropped by JSON.stringify on the way to the cloud anyway.
            try {
                worker.postMessage(JSON.parse(JSON.stringify(message)));
            } catch {
                logWarn(`failed to post message to cloud worker: ${(error as any)?.message ?? error}`);
            }
        }
    }

    private async handleWorkerMessage(message: CloudWorkerToMainMessage) {
        switch (message.type) {
            case "open":
                this.reconnectFailures = 0;
                setManagedConnection("cloud", {
                    enabled: true,
                    connected: true,
                    state: "connected",
                    message: "connected",
                });
                logSuccess("cloud integration connected");
                this.syncModerators();
                this.sendSnapshot();
                return;

            case "close":
                this.handleSocketClose(message.code, message.reason);
                return;

            case "socket-error":
                logWarn("cloud integration websocket error");
                logWarn(message.message);
                return;

            case "snapshot-request":
                this.sendSnapshot();
                return;

            case "kofi":
                await this.handleKofiEvent(message.message);
                return;

            case "api":
                await this.handleApiRequest(message);
                return;

            case "log":
                if (message.level === "error") logError(message.message);
                else if (message.level === "warn") logWarn(message.message);
                else logRegular(message.message);
                return;
        }
    }

    private handleSocketClose(code: number, reason: string) {
        this.socketActive = false;
        logWarn(`cloud websocket closed (${code}${reason ? `: ${reason}` : ""})`);
        setManagedConnection("cloud", {
            enabled: Boolean(getCloudIntegration().enabled),
            connected: false,
            state: "disconnected",
            message: `disconnected (${code}${reason ? `: ${reason}` : ""})`,
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
    }

    private clearReconnect() {
        if (!this.reconnectTimer) return;
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = undefined;
    }

    private async handleApiRequest(request: Extract<CloudWorkerToMainMessage, {type: "api"}>) {
        const {requestId, method, params, requestedByLogin} = request;

        logRegular(`cloud API request: ${method}${requestedByLogin ? ` by ${requestedByLogin}` : ""}`);

        try {
            const {default: getWebsocketServer} = await import("../../App");
            const result = await getWebsocketServer().dispatchApiMethod(method, params);

            logSuccess(`cloud API completed: ${method}${requestedByLogin ? ` by ${requestedByLogin}` : ""}`);
            this.post({
                type: "send",
                payload: {
                    type: "action_result",
                    request_id: requestId,
                    success: true,
                    data: result ?? {status: "okay"},
                },
            });

            // State changes caused by the action are forwarded through the normal
            // notify_* path as deltas; do not resend the entire cloud snapshot.
        } catch (error: any) {
            const errorMessage = error?.message ?? String(error);
            logWarn(`cloud API failed: ${method} - ${errorMessage}`);
            this.post({
                type: "send",
                payload: {
                    type: "action_result",
                    request_id: requestId,
                    success: false,
                    error: errorMessage,
                },
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

    async getTwitchUserInfo(user: string): Promise<any> {
        const result =
            await getTwitchUserInfo(user);

        if (!result) {
            throw new Error("user not found");
        }

        return result;
    }
}
