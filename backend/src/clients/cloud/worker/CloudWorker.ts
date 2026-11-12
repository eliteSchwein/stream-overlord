// Worker-thread entry point (bundled separately to dist/cloud-worker.js).
//
// Owns the cloud WebSocket and the per-update work: stripping cava data,
// keeping full state, computing deltas, JSON encoding, hashing, flushing under
// back-pressure and parsing incoming messages. Everything that needs the rest
// of the app (registration, connection status, reconnect policy, running API
// actions, Ko-fi events, building snapshots) stays in CloudClient on the main
// thread.
//
// Must not import anything from the main application.

import {parentPort} from "node:worker_threads";
import {createHash} from "node:crypto";
import WebSocket from "ws";
import {
    cloneCloudValue,
    createCloudDelta,
    firstString,
    isCloudSuppressedUpdate,
    normalizeCloudApiMethod,
    normalizeCloudApiParams,
    stripCloudSuppressedData,
} from "../CloudShared";
import {CloudWorkerToMainMessage, MainToCloudWorkerMessage} from "./CloudWorkerProtocol";

const HEARTBEAT_WATCHDOG_INTERVAL = 10_000;
const HEARTBEAT_STALE_AFTER = 30_000;
const CLOUD_BUFFERED_AMOUNT_LIMIT = 2 * 1024 * 1024;
const CLOUD_UPDATE_FLUSH_DELAY = 100;

if (!parentPort) {
    throw new Error("CloudWorker must be started as a worker thread");
}

const port = parentPort;

let socket: WebSocket | undefined;
let lastState: Record<string, any> = {};
let lastSentState: Record<string, any> = {};
const lastUpdateSignatures = new Map<string, string>();
const pendingUpdates = new Map<string, {data: any; fullState: any}>();
let updateFlushTimer: ReturnType<typeof setTimeout> | undefined;
let heartbeatWatchdog: ReturnType<typeof setInterval> | undefined;
let lastCloudActivityAt = 0;

function post(message: CloudWorkerToMainMessage) {
    port.postMessage(message);
}

function log(level: "regular" | "warn" | "error", message: string) {
    post({type: "log", level, message});
}

function describeError(error: unknown) {
    return JSON.stringify(error, Object.getOwnPropertyNames(error ?? {}));
}

// --- socket lifecycle -------------------------------------------------------

function markCloudActivity() {
    lastCloudActivityAt = Date.now();
}

function stopHeartbeatWatchdog() {
    if (!heartbeatWatchdog) return;
    clearInterval(heartbeatWatchdog);
    heartbeatWatchdog = undefined;
}

function startHeartbeatWatchdog(current: WebSocket) {
    stopHeartbeatWatchdog();
    heartbeatWatchdog = setInterval(() => {
        if (socket !== current || current.readyState !== WebSocket.OPEN) return;

        const inactiveFor = Date.now() - lastCloudActivityAt;
        if (inactiveFor <= HEARTBEAT_STALE_AFTER) return;

        log("warn", `cloud websocket heartbeat stale for ${Math.round(inactiveFor / 1000)}s; reconnecting`);
        // terminate() is intentional here: for a half-open TCP connection close()
        // can wait indefinitely and would not trigger the normal reconnect path.
        current.terminate();
    }, HEARTBEAT_WATCHDOG_INTERVAL);
}

function clearUpdateFlush() {
    if (!updateFlushTimer) return;
    clearTimeout(updateFlushTimer);
    updateFlushTimer = undefined;
}

function closeSocket() {
    stopHeartbeatWatchdog();
    const current = socket;
    socket = undefined;
    if (!current) return;
    try {
        current.removeAllListeners();
        // Swallow late errors from the socket we are abandoning.
        current.on("error", () => undefined);
        current.close();
    } catch {
        // Ignore.
    }
}

function connect(url: string) {
    closeSocket();

    const current = new WebSocket(url);
    socket = current;

    current.on("open", () => {
        if (socket !== current) return;
        markCloudActivity();
        startHeartbeatWatchdog(current);
        lastUpdateSignatures.clear();
        lastSentState = {};
        pendingUpdates.clear();
        // Main replies with moderators and the snapshot.
        post({type: "open"});
    });

    current.on("message", raw => {
        markCloudActivity();
        try {
            handleMessage(raw.toString());
        } catch (error) {
            log("warn", "cloud message failed");
            log("warn", describeError(error));
        }
    });

    // ws replies to pings automatically; track them for the watchdog.
    current.on("ping", markCloudActivity);
    current.on("pong", markCloudActivity);

    current.on("error", error => {
        if (socket !== current) return;
        post({type: "socket-error", message: error instanceof Error ? error.message : String(error)});
    });

    current.on("close", (code, reason) => {
        if (socket === current) socket = undefined;
        stopHeartbeatWatchdog();
        clearUpdateFlush();
        post({type: "close", code, reason: reason?.length ? reason.toString() : ""});
    });
}

// --- outgoing ------------------------------------------------------------------

function send(data: any) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    if (socket.bufferedAmount > CLOUD_BUFFERED_AMOUNT_LIMIT) return false;
    try {
        socket.send(JSON.stringify(data));
        return true;
    } catch (error) {
        log("error", "failed to send cloud websocket message");
        log("error", describeError(error));
        return false;
    }
}

function scheduleUpdateFlush() {
    if (updateFlushTimer) return;
    updateFlushTimer = setTimeout(() => {
        updateFlushTimer = undefined;
        flushPendingUpdates();
    }, CLOUD_UPDATE_FLUSH_DELAY);
}

function flushPendingUpdates() {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    if (socket.bufferedAmount > CLOUD_BUFFERED_AMOUNT_LIMIT) {
        scheduleUpdateFlush();
        return;
    }

    for (const [method, pending] of Array.from(pendingUpdates.entries())) {
        if (!socket || socket.readyState !== WebSocket.OPEN) return;
        if (socket.bufferedAmount > CLOUD_BUFFERED_AMOUNT_LIMIT) {
            scheduleUpdateFlush();
            return;
        }

        if (send({type: "update", method, data: pending.data, partial: true})) {
            lastSentState[method] = cloneCloudValue(pending.fullState);
            try {
                lastUpdateSignatures.set(
                    method,
                    createHash("sha1").update(JSON.stringify(pending.fullState)).digest("hex"),
                );
            } catch {
                // Ignore.
            }
            pendingUpdates.delete(method);
        } else {
            scheduleUpdateFlush();
            return;
        }
    }
}

function handleLocalUpdate(method: string, data: any, macros?: any) {
    // CAVA stays local-only and must never occupy cloud state/bandwidth.
    if (isCloudSuppressedUpdate(method)) {
        delete lastState[method];
        delete lastSentState[method];
        lastUpdateSignatures.delete(method);
        pendingUpdates.delete(method);
        return;
    }

    let cleanData = stripCloudSuppressedData(data);

    if (macros !== undefined) {
        cleanData = {
            ...(cleanData && typeof cleanData === "object" ? cleanData : {}),
            macros,
        };
    }

    // stripCloudSuppressedData already returns a fresh copy.
    lastState[method] = cleanData;

    // The first cloud connection gets a complete snapshot. After that, compare
    // every notify against the last state that was actually delivered to cloud
    // and forward only changed keys. If this notify was not part of the initial
    // snapshot yet, its first update is intentionally sent in full.
    const hasBaseline = Object.prototype.hasOwnProperty.call(lastSentState, method);
    const delta = hasBaseline
        ? createCloudDelta(lastSentState[method], cleanData)
        : cloneCloudValue(cleanData);

    if (delta === undefined) return;

    // Keep only the newest cumulative delta per method while the cloud socket is
    // congested. fullState is committed only after the delta was really sent.
    pendingUpdates.set(method, {
        data: delta,
        fullState: cleanData,
    });
    flushPendingUpdates();
}

function sendSnapshot(extra: Extract<MainToCloudWorkerMessage, {type: "snapshot"}>["extra"]) {
    try {
        const status = {
            ...lastState,
            game: extra.game,
            music: extra.music,
            connections: extra.connections,
        };

        const payload = stripCloudSuppressedData({
            type: "snapshot",
            data: {
                macros: extra.macros,
                interactions: extra.interactions,
                status,
                dashboard: extra.dashboard,
            },
        });

        if (send(payload)) {
            // A snapshot establishes a fresh baseline for this websocket. Every
            // later notify is sent as a partial-key delta against this exact state.
            lastSentState = {};
            for (const [method, data] of Object.entries(lastState)) {
                lastSentState[method] = cloneCloudValue(data);
                try {
                    lastUpdateSignatures.set(
                        method,
                        createHash("sha1").update(JSON.stringify(data)).digest("hex"),
                    );
                } catch {
                    // Ignore.
                }
                pendingUpdates.delete(method);
            }
        }
    } catch (error) {
        log("error", "failed to build/send cloud snapshot");
        log("error", describeError(error));
    }
}

// --- incoming --------------------------------------------------------------------

function handleMessage(raw: string) {
    let message: any;
    try {
        message = JSON.parse(raw);
    } catch {
        return;
    }

    const topType = String(message?.type ?? "").trim().toLowerCase();

    if (topType === "notify_kofi_event") {
        post({type: "kofi", message});
        return;
    }

    if (["snapshot_request", "snapshot.request"].includes(topType)) {
        post({type: "snapshot-request"});
        return;
    }

    const nested = message?.data && typeof message.data === "object" && !Array.isArray(message.data)
        ? message.data
        : null;

    const requestId = firstString(
        message?.request_id,
        message?.requestId,
        nested?.request_id,
        nested?.requestId,
        message?.id,
    );
    const requestedBy = message?.requested_by ?? message?.requestedBy ?? nested?.requested_by ?? nested?.requestedBy;
    const requestedByLogin = firstString(requestedBy?.login, requestedBy?.display_name, requestedBy?.twitch_user_id);

    const section = firstString(message?.section, nested?.section);
    const action = firstString(message?.action, message?.command, nested?.action, nested?.command);
    const explicitMethod = firstString(message?.method, nested?.method);
    const method = normalizeCloudApiMethod(section, action, explicitMethod);

    if (!method) return;

    let rawParams: any = {};
    if (message?.params && typeof message.params === "object") rawParams = message.params;
    else if (message?.payload && typeof message.payload === "object") rawParams = message.payload;
    else if (nested?.params && typeof nested.params === "object") rawParams = nested.params;
    else if (nested?.payload && typeof nested.payload === "object") rawParams = nested.payload;

    post({
        type: "api",
        requestId,
        method,
        params: normalizeCloudApiParams(method, rawParams),
        requestedByLogin,
    });
}

port.on("message", (message: MainToCloudWorkerMessage) => {
    // An exception here must never kill the thread: on the main thread the
    // same failure was caught by WebsocketServer's sink try/catch and logged,
    // and CloudClient treats a worker exit as a dropped connection.
    try {
        handleMainMessage(message);
    } catch (error) {
        log("error", `cloud worker failed to handle "${message?.type}"${message?.type === "update" ? ` (${message.method})` : ""}`);
        log("error", describeError(error));
    }
});

function handleMainMessage(message: MainToCloudWorkerMessage) {
    switch (message.type) {
        case "connect":
            connect(message.url);
            return;
        case "disconnect":
            clearUpdateFlush();
            pendingUpdates.clear();
            closeSocket();
            return;
        case "update":
            handleLocalUpdate(message.method, message.data, message.macros);
            return;
        case "snapshot":
            sendSnapshot(message.extra);
            return;
        case "send":
            send(message.payload);
            return;
    }
}
