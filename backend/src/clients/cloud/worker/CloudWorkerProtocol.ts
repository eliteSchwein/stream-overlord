// Messages between CloudClient (main thread) and CloudWorker (worker thread).

export type CloudSnapshotExtra = {
    macros: any;
    interactions: any;
    dashboard: any;
    game: any;
    music: any;
    connections: any;
};

export type MainToCloudWorkerMessage =
    // Close any current socket, then connect to url.
    | {type: "connect"; url: string}
    // Close the socket without a close notification and drop queued updates.
    | {type: "disconnect"}
    // A forwarded local notify_* state. The worker strips cava data, keeps the
    // latest full state and sends a delta against what the cloud last received.
    // `macros` (notify_macro_update only) is the cloud projection of the macro
    // list; it replaces data.macros after stripping, as before.
    | {type: "update"; method: string; data: any; macros?: any}
    | {type: "snapshot"; extra: CloudSnapshotExtra}
    | {type: "send"; payload: any};

export type CloudWorkerToMainMessage =
    | {type: "open"}
    | {type: "close"; code: number; reason: string}
    | {type: "socket-error"; message: string}
    | {type: "kofi"; message: any}
    | {type: "snapshot-request"}
    | {type: "api"; requestId: string; method: string; params: any; requestedByLogin: string}
    | {type: "log"; level: "regular" | "warn" | "error"; message: string};
