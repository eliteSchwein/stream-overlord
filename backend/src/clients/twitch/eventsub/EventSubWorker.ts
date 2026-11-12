// Worker-thread entry point (bundled separately to dist/eventsub-worker.js).
//
// Owns the real EventSub WebSocket: connection, keepalives, reconnects and the
// Helix calls that create subscriptions. Notifications are forwarded to the
// main thread as raw JSON; the main thread turns them into Twurple event
// objects and runs the existing handlers.
//
// This file must not import anything from the main application (helpers,
// config, App) - only Twurple and the protocol types.

import {parentPort} from "node:worker_threads";
import {ApiClient} from "@twurple/api";
import type {AuthProvider} from "@twurple/auth";
import {EventSubWsListener} from "@twurple/eventsub-ws";
import {
    AuthMethod,
    HANDLER_ARG,
    MainToWorkerMessage,
    RecordedSubscription,
    WorkerToMainMessage,
} from "./EventSubWorkerProtocol";

if (!parentPort) {
    throw new Error("EventSubWorker must be started as a worker thread");
}

const port = parentPort;

function post(message: WorkerToMainMessage) {
    port.postMessage(message);
}

function errorMessage(error: unknown) {
    const err = error as any;
    return String(err?.cause?.message ?? err?.message ?? error ?? "unknown error");
}

function extractId(user: any) {
    return typeof user === "object" && user !== null ? String(user.id) : user;
}

// --- auth proxy -------------------------------------------------------------

let nextRequestId = 1;
const pendingAuth = new Map<number, {resolve: (value: any) => void; reject: (error: Error) => void}>();
const scopesByUser = new Map<string, string[]>();

function rememberScopes(token: any) {
    if (token?.userId && Array.isArray(token.scope)) {
        scopesByUser.set(String(token.userId), token.scope);
    }
    return token;
}

function requestAuth(method: AuthMethod, args: any[]): Promise<any> {
    const requestId = nextRequestId++;

    return new Promise((resolve, reject) => {
        pendingAuth.set(requestId, {resolve, reject});
        post({type: "auth", requestId, method, args});
    }).then(rememberScopes);
}

// Token handling stays on the main thread so a RefreshingAuthProvider never
// refreshes the same refresh token from two threads.
function createProxyAuthProvider(init: Extract<MainToWorkerMessage, {type: "init"}>): AuthProvider {
    const available = new Set(init.authMethods);

    const provider: any = {
        clientId: init.clientId,
        authorizationType: init.authorizationType,
        hasClientSecret: init.hasClientSecret,
        getCurrentScopesForUser: (user: any) => scopesByUser.get(String(extractId(user))) ?? [],
        getAccessTokenForUser: (user: any, ...scopeSets: any[]) =>
            requestAuth("getAccessTokenForUser", [extractId(user), ...scopeSets]),
        getAnyAccessToken: (user?: any) =>
            requestAuth("getAnyAccessToken", user === undefined ? [] : [extractId(user)]),
    };

    if (available.has("getAccessTokenForIntent")) {
        provider.getAccessTokenForIntent = (intent: string, ...scopeSets: any[]) =>
            requestAuth("getAccessTokenForIntent", [intent, ...scopeSets]);
    }
    if (available.has("getAppAccessToken")) {
        provider.getAppAccessToken = (forceNew?: boolean) => requestAuth("getAppAccessToken", [forceNew]);
    }
    if (available.has("refreshAccessTokenForUser")) {
        provider.refreshAccessTokenForUser = (user: any) =>
            requestAuth("refreshAccessTokenForUser", [extractId(user)]);
    }
    if (available.has("refreshAccessTokenForIntent")) {
        provider.refreshAccessTokenForIntent = (intent: string) =>
            requestAuth("refreshAccessTokenForIntent", [intent]);
    }

    return provider as AuthProvider;
}

// --- listener -----------------------------------------------------------------

let listener: EventSubWsListener | undefined;

function subscribe(recorded: RecordedSubscription) {
    if (!listener) return;

    const method = (listener as any)[recorded.method];
    if (typeof method !== "function") {
        post({type: "log", level: "warn", message: `eventsub worker: unknown subscription method ${recorded.method}`});
        return;
    }

    try {
        const args = recorded.args.map(arg => arg === HANDLER_ARG ? () => undefined : arg);
        const subscription = method.apply(listener, args);

        if (subscription?.id !== recorded.id) {
            post({
                type: "log",
                level: "warn",
                message: `eventsub worker: subscription id mismatch (${recorded.id} != ${subscription?.id})`,
            });
        }

        // Forward the raw notification instead of running a handler here. The
        // main thread rebuilds the Twurple event with its own ApiClient.
        subscription._handleData = async (body: any) => {
            post({type: "event", id: recorded.id, body});
        };
    } catch (error) {
        post({type: "subscription-failure", id: recorded.id, message: errorMessage(error)});
    }
}

function start(init: Extract<MainToWorkerMessage, {type: "init"}>) {
    const apiClient = new ApiClient({
        authProvider: createProxyAuthProvider(init),
        logger: {minLevel: "ERROR"},
    });

    listener = new EventSubWsListener({
        apiClient,
        logger: {minLevel: "ERROR"},
    });

    const active = listener;

    active.onUserSocketConnect(userId => post({type: "socket-connect", userId}));
    active.onUserSocketReady(userId => post({type: "socket-ready", userId}));
    active.onUserSocketDisconnect((userId, error) =>
        post({type: "socket-disconnect", userId, message: error ? errorMessage(error) : "disconnected"}));
    active.onSubscriptionCreateSuccess(subscription =>
        post({type: "subscription-success", id: subscription.id}));
    active.onSubscriptionCreateFailure((subscription, error) =>
        post({type: "subscription-failure", id: subscription.id, message: errorMessage(error)}));

    // Same ordering as before: attach every subscription while inactive, then
    // start() opens one socket per auth user and submits them once it is ready.
    for (const recorded of init.subscriptions) {
        subscribe(recorded);
    }

    active.start();
    post({type: "log", level: "regular", message: `eventsub worker started with ${init.subscriptions.length} subscriptions`});
}

port.on("message", (message: MainToWorkerMessage) => {
    switch (message.type) {
        case "init":
            start(message);
            break;

        case "subscribe":
            subscribe(message.subscription);
            break;

        case "auth-result": {
            const pending = pendingAuth.get(message.requestId);
            if (!pending) break;
            pendingAuth.delete(message.requestId);

            if (message.ok) {
                pending.resolve(message.value);
            } else {
                pending.reject(new Error((message as Extract<MainToWorkerMessage, {type: "auth-result"; ok: false}>).message));
            }
            break;
        }

        case "stop":
            try {
                listener?.stop();
            } catch (error) {
                post({type: "log", level: "warn", message: `eventsub worker stop failed: ${errorMessage(error)}`});
            }
            listener = undefined;
            post({type: "stopped"});
            break;
    }
});
