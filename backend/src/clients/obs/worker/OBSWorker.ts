// Worker-thread entry point (bundled separately to dist/obs-worker.js).
//
// Owns one OBS WebSocket connection: socket, handshake, message framing and
// JSON parsing. Requests come in from the main thread; responses and the
// events the main thread listens to go back to it.
//
// Must not import anything from the main application.

import {parentPort} from "node:worker_threads";
import OBSWebSocket from "obs-websocket-js";
import {MainToOBSWorkerMessage, OBSWorkerToMainMessage, SerializedOBSError} from "./OBSWorkerProtocol";

if (!parentPort) {
    throw new Error("OBSWorker must be started as a worker thread");
}

const port = parentPort;
const obs = new OBSWebSocket();
const listening = new Set<string>();

function post(message: OBSWorkerToMainMessage) {
    port.postMessage(message);
}

function serializeError(error: unknown): SerializedOBSError {
    const err = error as any;
    return {
        code: Number(err?.code ?? -1),
        message: String(err?.message ?? error ?? "unknown error"),
    };
}

function serializeEventData(data: unknown) {
    // ConnectionClosed / ConnectionError carry an OBSWebSocketError.
    if (data instanceof Error) return serializeError(data);
    return data;
}

async function reply(requestId: number, run: () => Promise<any>) {
    try {
        const value = await run();
        post({type: "result", requestId, ok: true, value: value ?? null});
    } catch (error) {
        post({type: "result", requestId, ok: false, error: serializeError(error)});
    }
}

port.on("message", (message: MainToOBSWorkerMessage) => {
    switch (message.type) {
        case "listen":
            if (listening.has(message.event)) return;
            listening.add(message.event);
            (obs as any).on(message.event, (data: unknown) => {
                post({type: "event", event: message.event, data: serializeEventData(data)});
            });
            return;

        case "connect":
            void reply(message.requestId, () =>
                obs.connect(message.url, message.password, message.identificationParams));
            return;

        case "disconnect":
            void reply(message.requestId, () => obs.disconnect());
            return;

        case "call":
            void reply(message.requestId, () =>
                (obs as any).call(message.requestType, message.requestData));
            return;

        case "callBatch":
            void reply(message.requestId, () =>
                (obs as any).callBatch(message.requests, message.options));
            return;
    }
});
