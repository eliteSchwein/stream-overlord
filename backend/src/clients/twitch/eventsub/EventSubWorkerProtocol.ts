// Messages exchanged between the main thread (EventSubWorkerBridge) and the
// EventSub worker thread (EventSubWorker). Everything must be structured-clone
// safe: plain objects, strings, numbers, arrays.

export const HANDLER_ARG = "__eventsub_handler__";

export type SubscriptionArg = string | number | boolean | null | typeof HANDLER_ARG;

export type RecordedSubscription = {
    // Twurple's deterministic subscription id, e.g. "channel.chat.message.123.123".
    id: string;
    // Public EventSubWsListener method name, e.g. "onChannelChatMessage".
    method: string;
    args: SubscriptionArg[];
};

export type AuthMethod =
    | "getAccessTokenForUser"
    | "getAccessTokenForIntent"
    | "getAnyAccessToken"
    | "getAppAccessToken"
    | "refreshAccessTokenForUser"
    | "refreshAccessTokenForIntent";

export type MainToWorkerMessage =
    | {
        type: "init";
        clientId: string;
        authorizationType?: string;
        hasClientSecret?: boolean;
        authMethods: AuthMethod[];
        subscriptions: RecordedSubscription[];
    }
    | {type: "subscribe"; subscription: RecordedSubscription}
    | {type: "auth-result"; requestId: number; ok: true; value: any}
    | {type: "auth-result"; requestId: number; ok: false; message: string}
    | {type: "stop"};

export type WorkerToMainMessage =
    | {type: "auth"; requestId: number; method: AuthMethod; args: any[]}
    | {type: "event"; id: string; body: any}
    | {type: "socket-connect"; userId: string}
    | {type: "socket-ready"; userId: string}
    | {type: "socket-disconnect"; userId: string; message: string}
    | {type: "subscription-success"; id: string}
    | {type: "subscription-failure"; id: string; message: string}
    | {type: "log"; level: "regular" | "warn"; message: string}
    | {type: "stopped"};
