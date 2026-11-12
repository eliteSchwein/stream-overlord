// Messages between WorkerOBSWebSocket (main thread) and OBSWorker (one worker
// thread per OBS connection). Everything must be structured-clone safe.

export type SerializedOBSError = {
    code: number;
    message: string;
};

export type MainToOBSWorkerMessage =
    | {type: "connect"; requestId: number; url: string; password?: string; identificationParams?: any}
    | {type: "disconnect"; requestId: number}
    | {type: "call"; requestId: number; requestType: string; requestData?: any}
    | {type: "callBatch"; requestId: number; requests: any[]; options?: any}
    | {type: "listen"; event: string};

export type OBSWorkerToMainMessage =
    | {type: "result"; requestId: number; ok: true; value: any}
    | {type: "result"; requestId: number; ok: false; error: SerializedOBSError}
    | {type: "event"; event: string; data: any};
