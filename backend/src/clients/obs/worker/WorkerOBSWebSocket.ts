import {Worker} from "node:worker_threads";
import {EventEmitter} from "node:events";
import OBSWebSocket, {OBSWebSocketError} from "obs-websocket-js";
import {resolveWorkerScript} from "../../../helper/WorkerHelper";
import {logWarn} from "../../../helper/LogHelper";
import {MainToOBSWorkerMessage, OBSWorkerToMainMessage, SerializedOBSError} from "./OBSWorkerProtocol";

const ERROR_EVENTS = new Set(["ConnectionClosed", "ConnectionError"]);

// obs-websocket-js uses 1000 / 4xxx close codes; -1 marks "worker died".
const WORKER_EXIT_CODE = -1;

type PendingRequest = {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
};

function toOBSError(error: SerializedOBSError) {
    return new OBSWebSocketError(error.code, error.message);
}

/**
 * Drop-in replacement for OBSWebSocket that runs the actual connection in its
 * own worker thread (OS thread name `obs-<name>`). Supports the API surface
 * this app uses: connect, disconnect, call, callBatch, on/once/off.
 *
 * Each instance owns one worker. The worker is created on connect() and
 * terminated when connect() fails, after disconnect(), or when the connection
 * closes - OBSClient creates a fresh instance for every reconnect attempt.
 */
export class WorkerOBSWebSocket {
    private readonly name: string;
    private readonly emitter = new EventEmitter();
    private readonly listening = new Set<string>();
    private readonly pending = new Map<number, PendingRequest>();

    private worker?: Worker;
    private nextRequestId = 1;

    constructor(name: string) {
        this.name = name;
        this.emitter.setMaxListeners(100);
    }

    get threadId() {
        return this.worker?.threadId;
    }

    on(event: string, listener: (...args: any[]) => void) {
        this.emitter.on(event, listener);
        this.listen(event);
        return this;
    }

    once(event: string, listener: (...args: any[]) => void) {
        this.emitter.once(event, listener);
        this.listen(event);
        return this;
    }

    off(event: string, listener: (...args: any[]) => void) {
        this.emitter.off(event, listener);
        return this;
    }

    removeAllListeners(event?: string) {
        this.emitter.removeAllListeners(event);
        return this;
    }

    async connect(url?: string, password?: string, identificationParams?: any) {
        const worker = this.ensureWorker();

        try {
            return await this.request({type: "connect", url: url ?? "ws://127.0.0.1:4455", password, identificationParams});
        } catch (error) {
            this.shutdown(worker);
            throw error;
        }
    }

    async disconnect() {
        const worker = this.worker;
        if (!worker) return;

        try {
            await this.request({type: "disconnect"});
        } finally {
            // Results and events are delivered in order, so ConnectionClosed
            // has already been emitted by the time the disconnect resolves.
            this.shutdown(worker);
        }
    }

    async call(requestType: string, requestData?: any) {
        if (!this.worker) throw new OBSWebSocketError(-1, "Socket not connected");
        return await this.request({type: "call", requestType, requestData});
    }

    async callBatch(requests: any[], options?: any) {
        if (!this.worker) throw new OBSWebSocketError(-1, "Socket not connected");
        return await this.request({type: "callBatch", requests, options});
    }

    private listen(event: string) {
        if (this.listening.has(event)) return;
        this.listening.add(event);

        if (this.worker) {
            this.post(this.worker, {type: "listen", event});
        }
    }

    private ensureWorker() {
        if (this.worker) return this.worker;

        const worker = new Worker(resolveWorkerScript("obs-worker.js"), {name: `obs-${this.name}`});
        this.worker = worker;

        worker.on("message", (message: OBSWorkerToMainMessage) => this.handleMessage(message));

        worker.on("error", error => {
            logWarn(`obs worker error (${this.name}): ${(error as any)?.message ?? error}`);
        });

        worker.on("exit", code => {
            if (this.worker !== worker) return;
            this.worker = undefined;

            const error = new OBSWebSocketError(WORKER_EXIT_CODE, `OBS worker exited (code=${code})`);
            this.rejectAll(error);
            this.emitter.emit("ConnectionClosed", error);
        });

        for (const event of this.listening) {
            this.post(worker, {type: "listen", event});
        }

        return worker;
    }

    // Any MainToOBSWorkerMessage that carries a requestId, minus the requestId.
    private request(message: {type: Extract<MainToOBSWorkerMessage, {requestId: number}>["type"]; [key: string]: any}) {
        const worker = this.worker;
        if (!worker) {
            return Promise.reject(new OBSWebSocketError(-1, "Socket not connected"));
        }

        const requestId = this.nextRequestId++;

        return new Promise<any>((resolve, reject) => {
            this.pending.set(requestId, {resolve, reject});
            this.post(worker, {...message, requestId} as MainToOBSWorkerMessage);
        });
    }

    private post(worker: Worker, message: MainToOBSWorkerMessage) {
        try {
            worker.postMessage(message);
        } catch (error) {
            logWarn(`failed to post message to obs worker (${this.name}): ${(error as any)?.message ?? error}`);
        }
    }

    private shutdown(worker: Worker) {
        if (this.worker !== worker) return;

        this.worker = undefined;
        this.rejectAll(new OBSWebSocketError(-1, "Socket not connected"));
        void worker.terminate();
    }

    private rejectAll(error: Error) {
        for (const pending of this.pending.values()) {
            pending.reject(error);
        }
        this.pending.clear();
    }

    private handleMessage(message: OBSWorkerToMainMessage) {
        if (message.type === "result") {
            const pending = this.pending.get(message.requestId);
            if (!pending) return;
            this.pending.delete(message.requestId);

            if (message.ok) {
                pending.resolve(message.value);
            } else {
                pending.reject(toOBSError((message as Extract<OBSWorkerToMainMessage, {type: "result"; ok: false}>).error));
            }
            return;
        }

        const data = ERROR_EVENTS.has(message.event) && message.data
            ? toOBSError(message.data)
            : message.data;

        this.emitter.emit(message.event, data);

        // The connection is gone; OBSClient reconnects with a new instance.
        if (message.event === "ConnectionClosed" && this.worker) {
            this.shutdown(this.worker);
        }
    }
}

// Typed as OBSWebSocket so existing call sites keep their request/response types.
export function createWorkerOBSWebSocket(name: string): OBSWebSocket {
    return new WorkerOBSWebSocket(name) as unknown as OBSWebSocket;
}
