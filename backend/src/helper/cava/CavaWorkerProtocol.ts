// Messages between CavaFeed (main thread) and CavaWorker (worker thread).

export type CavaSource = "music" | "tts" | "alert";

export type CavaTarget = {
    target: string;
    configPath: string;
    bars: number;
    framerate: number;
    source: CavaSource;
};

export type MainToCavaWorkerMessage =
    | {type: "start"; targets: CavaTarget[]}
    // Number of overlay sockets currently connected for a target. Frames for
    // targets without listeners are not encoded or posted at all.
    | {type: "listeners"; target: string; count: number}
    | {type: "stop"};

export type CavaWorkerToMainMessage =
    | {
        type: "frame";
        target: string;
        raw: string;
        // Fully encoded notify_music_cava JSON-RPC message, ready to send.
        payload: string;
        bars: number;
        framerate: number;
        source: CavaSource;
    }
    | {type: "log"; level: "regular" | "debug" | "warn"; message: string}
    | {type: "stopped"};
