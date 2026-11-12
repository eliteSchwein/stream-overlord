import {Worker} from "node:worker_threads";
import {EventSubWsListener} from "@twurple/eventsub-ws";
import type {ApiClient} from "@twurple/api";
import type {AuthProvider} from "@twurple/auth";
import {logRegular, logWarn} from "../../../helper/LogHelper";
import {resolveWorkerScript} from "../../../helper/WorkerHelper";
import {
    AuthMethod,
    HANDLER_ARG,
    MainToWorkerMessage,
    RecordedSubscription,
    SubscriptionArg,
    WorkerToMainMessage,
} from "./EventSubWorkerProtocol";

const AUTH_METHODS: AuthMethod[] = [
    "getAccessTokenForUser",
    "getAccessTokenForIntent",
    "getAnyAccessToken",
    "getAppAccessToken",
    "refreshAccessTokenForUser",
    "refreshAccessTokenForIntent",
];

const RESTART_DELAY_MS = 5_000;
const STOP_TIMEOUT_MS = 5_000;

export type EventSubWorkerSocketState = {
    connected: boolean;
    readyToSubscribe: boolean;
};

function toCloneable(value: unknown) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function errorMessage(error: unknown) {
    const err = error as any;
    return String(err?.message ?? error ?? "unknown error");
}

/**
 * Runs the EventSub WebSocket in a worker thread.
 *
 * `listener` is an EventSubWsListener that is never started on the main
 * thread. Event classes register on it exactly as before; every subscription
 * is recorded and recreated in the worker. Notifications come back as raw
 * JSON and are dispatched through the shadow subscription's own
 * `_handleData`, so handlers receive normal Twurple event objects bound to
 * the main-thread ApiClient.
 *
 * Socket / subscription lifecycle events from the worker are re-emitted on
 * the shadow listener (onUserSocketConnect, onSubscriptionCreateSuccess, ...),
 * so existing `listener.on(listener.onX, ...)` observers keep working.
 */
export default class EventSubWorkerBridge {
    readonly listener: EventSubWsListener;

    private readonly authProvider: AuthProvider;
    private readonly recorded = new Map<string, RecordedSubscription>();
    private readonly sockets = new Map<string, EventSubWorkerSocketState>();

    private worker?: Worker;
    private running = false;
    private restartTimer?: ReturnType<typeof setTimeout>;

    constructor(apiClient: ApiClient, authProvider: AuthProvider) {
        this.authProvider = authProvider;
        this.listener = new EventSubWsListener({
            apiClient,
            logger: {minLevel: "ERROR"},
        });

        this.instrumentListener();
    }

    get isActive() {
        return this.running;
    }

    get subscriptionCount() {
        return this.recorded.size;
    }

    getSocketStates() {
        return new Map(this.sockets);
    }

    start() {
        if (this.running) return;

        this.running = true;
        this.spawnWorker();
    }

    async stop() {
        this.running = false;
        clearTimeout(this.restartTimer);
        this.restartTimer = undefined;

        const worker = this.worker;
        this.worker = undefined;
        this.sockets.clear();

        if (!worker) return;

        // Ask the worker to close its sockets cleanly, then terminate it.
        await new Promise<void>(resolve => {
            const timeout = setTimeout(resolve, STOP_TIMEOUT_MS);

            worker.on("message", (message: WorkerToMainMessage) => {
                if (message.type !== "stopped") return;
                clearTimeout(timeout);
                resolve();
            });
            worker.once("exit", () => {
                clearTimeout(timeout);
                resolve();
            });

            this.post(worker, {type: "stop"});
        });

        await worker.terminate().catch(() => undefined);
    }

    // Wrap every public `onXxx(...)` subscription method of the shadow listener
    // so each call is recorded. Event binders such as onUserSocketConnect are
    // instance properties (not prototype methods) and are left alone.
    private instrumentListener() {
        const listener = this.listener as any;
        const wrapped = new Set<string>();
        let proto = Object.getPrototypeOf(listener);

        while (proto && proto !== Object.prototype) {
            for (const name of Object.getOwnPropertyNames(proto)) {
                if (wrapped.has(name) || !/^on[A-Z]/.test(name)) continue;
                if (Object.prototype.hasOwnProperty.call(listener, name)) continue;

                const original = Object.getOwnPropertyDescriptor(proto, name)?.value;
                if (typeof original !== "function") continue;

                wrapped.add(name);
                listener[name] = (...args: unknown[]) => {
                    const subscription = original.apply(listener, args);
                    this.record(name, args, subscription);
                    return subscription;
                };
            }

            proto = Object.getPrototypeOf(proto);
        }
    }

    private record(method: string, args: unknown[], subscription: any) {
        const id = String(subscription?.id ?? "");
        if (!id) return;

        const recordedArgs: SubscriptionArg[] = args.map(arg => {
            if (typeof arg === "function") return HANDLER_ARG;
            if (typeof arg === "object" && arg !== null) return String((arg as any).id);
            return arg as SubscriptionArg;
        });

        const recorded: RecordedSubscription = {id, method, args: recordedArgs};
        this.recorded.set(id, recorded);

        if (this.worker) {
            this.post(this.worker, {type: "subscribe", subscription: recorded});
        }
    }

    private spawnWorker() {
        const workerPath = resolveWorkerScript("eventsub-worker.js");
        // The name becomes the OS thread name (visible in `top -H` / `ps -T`).
        const worker = new Worker(workerPath, {name: "twitch-eventsub"});
        this.worker = worker;

        worker.on("message", (message: WorkerToMainMessage) => {
            if (this.worker !== worker) return;
            this.handleMessage(worker, message);
        });

        worker.on("error", error => {
            logWarn(`twitch eventsub worker error: ${errorMessage(error)}`);
        });

        worker.on("exit", code => {
            if (this.worker !== worker) return;

            this.worker = undefined;
            this.sockets.clear();

            if (!this.running) return;

            logWarn(`twitch eventsub worker exited (code=${code}) - restarting in ${RESTART_DELAY_MS} ms`);
            this.restartTimer = setTimeout(() => {
                this.restartTimer = undefined;
                if (this.running && !this.worker) this.spawnWorker();
            }, RESTART_DELAY_MS);
        });

        const provider = this.authProvider as any;

        this.post(worker, {
            type: "init",
            clientId: provider.clientId,
            authorizationType: provider.authorizationType,
            hasClientSecret: provider.hasClientSecret,
            authMethods: AUTH_METHODS.filter(method => typeof provider[method] === "function"),
            subscriptions: [...this.recorded.values()],
        });

        logRegular(`twitch eventsub worker spawned (threadId=${worker.threadId}, ${workerPath})`);
    }

    private post(worker: Worker, message: MainToWorkerMessage) {
        try {
            worker.postMessage(message);
        } catch (error) {
            logWarn(`failed to post message to twitch eventsub worker: ${errorMessage(error)}`);
        }
    }

    private emit(event: any, ...args: unknown[]) {
        (this.listener as any).emit(event, ...args);
    }

    private getShadowSubscription(id: string) {
        return (this.listener as any)._subscriptions?.get(id);
    }

    private handleMessage(worker: Worker, message: WorkerToMainMessage) {
        switch (message.type) {
            case "event": {
                const subscription = this.getShadowSubscription(message.id);
                if (!subscription) return;

                Promise.resolve(subscription._handleData(message.body)).catch((error: unknown) => {
                    logWarn(`twitch eventsub handler for ${message.id} failed`);
                    logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
                });
                return;
            }

            case "auth":
                void this.handleAuthRequest(worker, message);
                return;

            case "socket-connect":
                this.sockets.set(message.userId, {connected: true, readyToSubscribe: false});
                this.emit(this.listener.onUserSocketConnect, message.userId);
                return;

            case "socket-ready":
                this.sockets.set(message.userId, {connected: true, readyToSubscribe: true});
                this.emit(this.listener.onUserSocketReady, message.userId);
                return;

            case "socket-disconnect":
                this.sockets.set(message.userId, {connected: false, readyToSubscribe: false});
                this.emit(this.listener.onUserSocketDisconnect, message.userId, new Error(message.message));
                return;

            case "subscription-success": {
                const subscription = this.getShadowSubscription(message.id);
                this.emit(this.listener.onSubscriptionCreateSuccess, subscription ?? {id: message.id}, undefined);
                return;
            }

            case "subscription-failure": {
                const subscription = this.getShadowSubscription(message.id);
                this.emit(this.listener.onSubscriptionCreateFailure, subscription ?? {id: message.id}, new Error(message.message));
                return;
            }

            case "log":
                if (message.level === "warn") {
                    logWarn(message.message);
                } else {
                    logRegular(message.message);
                }
                return;

            case "stopped":
                return;
        }
    }

    private async handleAuthRequest(worker: Worker, message: Extract<WorkerToMainMessage, {type: "auth"}>) {
        const method = (this.authProvider as any)[message.method];

        try {
            if (typeof method !== "function") {
                throw new Error(`auth provider does not support ${message.method}`);
            }

            const value = await method.apply(this.authProvider, message.args);
            this.post(worker, {type: "auth-result", requestId: message.requestId, ok: true, value: toCloneable(value) ?? null});
        } catch (error) {
            this.post(worker, {type: "auth-result", requestId: message.requestId, ok: false, message: errorMessage(error)});
        }
    }
}
