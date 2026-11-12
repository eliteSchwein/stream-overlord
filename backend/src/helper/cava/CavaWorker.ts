// Worker-thread entry point (bundled separately to dist/cava-worker.js).
//
// Owns the cava processes: reads their stdout (up to 60 frames/s per target),
// drops duplicate frames and builds the JSON-RPC message. The main thread only
// writes the finished string to the overlay sockets, because those sockets
// belong to the main WebSocket server and cannot move between threads.
//
// Must not import anything from the main application.

import {parentPort} from "node:worker_threads";
import {ChildProcessWithoutNullStreams, spawn} from "node:child_process";
import {CavaTarget, CavaWorkerToMainMessage, MainToCavaWorkerMessage} from "./CavaWorkerProtocol";

if (!parentPort) {
    throw new Error("CavaWorker must be started as a worker thread");
}

const port = parentPort;
const processes = new Map<string, ChildProcessWithoutNullStreams>();
const targets = new Map<string, CavaTarget>();
const lastFrames = new Map<string, string>();
const listeners = new Map<string, number>();

function post(message: CavaWorkerToMainMessage) {
    port.postMessage(message);
}

function postFrame(config: CavaTarget, raw: string) {
    post({
        type: "frame",
        target: config.target,
        raw,
        payload: JSON.stringify({
            jsonrpc: "2.0",
            method: "notify_music_cava",
            params: {
                target: config.target,
                bars: config.bars,
                framerate: config.framerate,
                source: config.source,
                raw,
            },
            id: Math.floor(Math.random() * 10_000),
        }),
        bars: config.bars,
        framerate: config.framerate,
        source: config.source,
    });
}

function stopAll() {
    for (const child of processes.values()) {
        try {
            child.kill();
        } catch {
            // Already gone.
        }
    }

    processes.clear();
    targets.clear();
    lastFrames.clear();
}

function start(configs: CavaTarget[]) {
    stopAll();

    for (const config of configs) {
        targets.set(config.target, config);

        const child = spawn("cava", ["-p", config.configPath]);
        processes.set(config.target, child);

        post({type: "log", level: "regular", message: `cava ${config.target} created`});

        child.stdout.on("data", data => {
            const raw = data.toString();
            if (lastFrames.get(config.target) === raw) return;
            lastFrames.set(config.target, raw);

            if (!listeners.get(config.target)) return;
            postFrame(config, raw);
        });

        child.stderr.on("data", data => {
            post({type: "log", level: "debug", message: `cava ${config.target} ${data.toString().trim()}`});
        });

        child.on("exit", () => {
            if (processes.get(config.target) === child) processes.delete(config.target);
        });

        child.on("error", error => {
            post({type: "log", level: "warn", message: `cava${config.target} failed to start: ${error.message}`});
            if (processes.get(config.target) === child) processes.delete(config.target);
        });
    }
}

port.on("message", (message: MainToCavaWorkerMessage) => {
    switch (message.type) {
        case "start":
            start(message.targets);
            return;

        case "listeners": {
            const previous = listeners.get(message.target) ?? 0;
            listeners.set(message.target, message.count);

            // A first listener appeared: give it the newest frame right away.
            const config = targets.get(message.target);
            const raw = lastFrames.get(message.target);
            if (previous === 0 && message.count > 0 && config && raw !== undefined) {
                postFrame(config, raw);
            }
            return;
        }

        case "stop":
            stopAll();
            post({type: "stopped"});
            return;
    }
});
