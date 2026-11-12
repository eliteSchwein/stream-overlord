import {Worker} from "node:worker_threads";
import {resolveWorkerScript} from "../WorkerHelper";
import {logDebug, logRegular, logWarn} from "../LogHelper";
import {CavaTarget, CavaWorkerToMainMessage, MainToCavaWorkerMessage} from "./CavaWorkerProtocol";

const STOP_TIMEOUT_MS = 2_000;

export type CavaFrameSink = (frame: Extract<CavaWorkerToMainMessage, {type: "frame"}>) => void;

/**
 * Runs the cava processes in the `cava` worker thread.
 *
 * The worker spawns cava, dedupes frames and encodes the JSON-RPC message;
 * `onFrame` only has to write the finished payload to the overlay sockets.
 */
export default class CavaFeed {
    private worker?: Worker;
    private readonly listenerCounts = new Map<string, number>();

    constructor(private readonly onFrame: CavaFrameSink) {}

    start(targets: CavaTarget[]) {
        this.stop();

        if (targets.length < 1) return;

        const worker = new Worker(resolveWorkerScript("cava-worker.js"), {name: "cava"});
        this.worker = worker;

        worker.on("message", (message: CavaWorkerToMainMessage) => {
            if (this.worker !== worker) return;

            switch (message.type) {
                case "frame":
                    this.onFrame(message);
                    return;
                case "log":
                    if (message.level === "warn") logWarn(message.message);
                    else if (message.level === "debug") logDebug(message.message);
                    else logRegular(message.message);
                    return;
                case "stopped":
                    return;
            }
        });

        worker.on("error", error => {
            logWarn(`cava worker error: ${(error as any)?.message ?? error}`);
        });

        worker.on("exit", code => {
            if (this.worker !== worker) return;
            this.worker = undefined;
            logWarn(`cava worker exited (code=${code})`);
        });

        // Listeners may already be connected (e.g. after a player restart).
        for (const [target, count] of this.listenerCounts) {
            this.post(worker, {type: "listeners", target, count});
        }

        this.post(worker, {type: "start", targets});
    }

    stop() {
        const worker = this.worker;
        this.worker = undefined;
        if (!worker) return;

        // Let the worker kill its cava processes before the thread goes away;
        // terminating it first would leave them running.
        const timeout = setTimeout(() => void worker.terminate(), STOP_TIMEOUT_MS);
        timeout.unref?.();

        worker.on("message", (message: CavaWorkerToMainMessage) => {
            if (message.type !== "stopped") return;
            clearTimeout(timeout);
            void worker.terminate();
        });

        this.post(worker, {type: "stop"});
    }

    setListenerCount(target: string, count: number) {
        if (count > 0) this.listenerCounts.set(target, count);
        else this.listenerCounts.delete(target);

        if (this.worker) {
            this.post(this.worker, {type: "listeners", target, count});
        }
    }

    private post(worker: Worker, message: MainToCavaWorkerMessage) {
        try {
            worker.postMessage(message);
        } catch (error) {
            logWarn(`failed to post message to cava worker: ${(error as any)?.message ?? error}`);
        }
    }
}
