import {AsyncLocalStorage} from "async_hooks";
import {randomUUID} from "crypto";
import getWebsocketServer from "../App";
import {logRegular, logWarn} from "./LogHelper";

export type InteractionSource = "command" | "event" | "channel_point" | "api" | "other";
export type InteractionState = "queued" | "active" | "finished" | "cancelled" | "failed";

export type Interaction = {
    uuid: string;
    name: string;
    source: InteractionSource;
    state: InteractionState;
    created_at: string;
    started_at?: string;
    finished_at?: string;
    duration: number;
    eta: string | null;
    eta_seconds: number;
    alert_count: number;
    error?: string;
};

type InternalInteraction = Interaction & {
    createdAtMs: number;
    startedAtMs?: number;
    holdUntilMs: number;
    executionFinished: boolean;
    alertTimingStarted: boolean;
    execute: (interaction: Interaction) => Promise<void> | void;
};

const context = new AsyncLocalStorage<{interactionUuid: string}>();
const queue: InternalInteraction[] = [];
let active: InternalInteraction | undefined;
let processing = false;
let initialized = false;
let lastSecond = -1;

function publicInteraction(item: InternalInteraction, now = Date.now(), queuedEtaSeconds = 0): Interaction {
    let etaSeconds = queuedEtaSeconds;

    if (item.state === "active") {
        etaSeconds = Math.max(0, Math.floor((item.holdUntilMs - now) / 1000));
    }

    return {
        uuid: item.uuid,
        name: item.name,
        source: item.source,
        state: item.state,
        created_at: item.created_at,
        started_at: item.started_at,
        finished_at: item.finished_at,
        duration: item.duration,
        eta: etaSeconds > 0 ? new Date(now + etaSeconds * 1000).toISOString() : null,
        eta_seconds: etaSeconds,
        alert_count: item.alert_count,
        error: item.error,
    };
}

export function getInteractionQueue(): Interaction[] {
    const now = Date.now();
    const result: Interaction[] = [];
    let cumulative = 0;

    if (active) {
        const current = publicInteraction(active, now);
        result.push(current);
        cumulative += current.eta_seconds;
    }

    for (const item of queue) {
        const ownEstimate = Math.max(0, Math.ceil(item.duration));
        result.push(publicInteraction(item, now, cumulative + ownEstimate));
        cumulative += ownEstimate;
    }

    return result;
}

function notifyQueue() {
    try {
        getWebsocketServer()?.send("notify_interaction_queue", getInteractionQueue());
    } catch (_) {
        // Websocket server may not be ready during startup.
    }
}

function notifyInteraction(item: InternalInteraction, action: "queued" | "start" | "update" | "finish" | "cancel" | "failed") {
    try {
        getWebsocketServer()?.send("notify_interaction", {
            action,
            interaction: publicInteraction(item),
        });
    } catch (_) {}
}

export function initInteractions() {
    if (initialized) return;
    initialized = true;

    setInterval(() => {
        const now = Date.now();
        const second = Math.floor(now / 1000);

        if (active && active.executionFinished && active.holdUntilMs <= now) {
            finishActiveInteraction("finished");
            return;
        }

        if (second !== lastSecond) {
            lastSecond = second;
            notifyQueue();
        }
    }, 250);
}

export function getCurrentInteractionUuid(): string | undefined {
    return context.getStore()?.interactionUuid;
}

export function hasInteraction(uuid: string | undefined): boolean {
    if (!uuid) return false;
    return active?.uuid === uuid || queue.some(item => item.uuid === uuid);
}

export function enqueueInteraction(options: {
    uuid?: string;
    name: string;
    source?: InteractionSource;
    estimatedDuration?: number;
    execute: (interaction: Interaction) => Promise<void> | void;
}): Interaction {
    const uuid = options.uuid || randomUUID();
    const createdAtMs = Date.now();
    const estimatedDuration = Math.max(0, Number(options.estimatedDuration ?? 0) || 0);

    const item: InternalInteraction = {
        uuid,
        name: String(options.name || "Interaction"),
        source: options.source ?? "other",
        state: "queued",
        created_at: new Date(createdAtMs).toISOString(),
        duration: estimatedDuration,
        eta: null,
        eta_seconds: 0,
        alert_count: 0,
        createdAtMs,
        holdUntilMs: 0,
        executionFinished: false,
        alertTimingStarted: false,
        execute: options.execute,
    };

    queue.push(item);
    logRegular(`queue interaction ${item.name} (${item.uuid})`);
    notifyInteraction(item, "queued");
    notifyQueue();
    void processQueue();

    return publicInteraction(item);
}

async function processQueue() {
    if (processing || active || queue.length === 0) return;
    processing = true;

    try {
        active = queue.shift();
        if (!active) return;

        active.state = "active";
        active.startedAtMs = Date.now();
        active.started_at = new Date(active.startedAtMs).toISOString();
        // An estimate supplied while queued becomes the initial hold once active.
        active.holdUntilMs = active.startedAtMs + active.duration * 1000;

        logRegular(`start interaction ${active.name} (${active.uuid})`);
        notifyInteraction(active, "start");
        notifyQueue();

        try {
            await context.run({interactionUuid: active.uuid}, async () => {
                await active!.execute(publicInteraction(active!));
            });
            active.executionFinished = true;
        } catch (error) {
            active.executionFinished = true;
            active.error = error instanceof Error ? error.message : String(error);
            logWarn(`interaction ${active.name} failed: ${active.error}`);
            finishActiveInteraction("failed");
            return;
        }

        if (active.holdUntilMs <= Date.now()) {
            finishActiveInteraction("finished");
        } else {
            notifyInteraction(active, "update");
            notifyQueue();
        }
    } finally {
        processing = false;
        if (!active && queue.length > 0) void processQueue();
    }
}

function finishActiveInteraction(state: "finished" | "cancelled" | "failed") {
    if (!active) return;

    const finished = active;
    finished.state = state;
    finished.finished_at = new Date().toISOString();

    logRegular(`${state} interaction ${finished.name} (${finished.uuid})`);
    notifyInteraction(finished, state === "cancelled" ? "cancel" : state === "failed" ? "failed" : "finish");

    active = undefined;
    notifyQueue();
    void processQueue();
}

export function markInteractionAlertStarted(uuid: string | undefined, remainingSeconds: number, alertUuid?: string) {
    const interactionUuid = uuid || getCurrentInteractionUuid();
    if (!interactionUuid || !active || active.uuid !== interactionUuid) return false;
    if (active.alertTimingStarted) return false;

    active.alertTimingStarted = true;

    // The alert loop consumes the first duration tick on the same cycle that
    // the alert is shown. Rebase to the duration that is still left after
    // that visible tick instead of restoring the full configured duration.
    // This removes setup time without adding an extra second at the end.
    const remaining = Math.max(0, Number(remainingSeconds) || 0);
    if (remaining > 0) {
        active.holdUntilMs = Date.now() + remaining * 1000;
    } else {
        active.holdUntilMs = Date.now();
    }

    logRegular(`start interaction alert timing ${active.name}${alertUuid ? ` for alert ${alertUuid}` : ""}`);
    notifyInteraction(active, "update");
    notifyQueue();
    return true;
}

export function extendInteraction(uuid: string | undefined, seconds: number, alertUuid?: string) {
    const interactionUuid = uuid || getCurrentInteractionUuid();
    if (!interactionUuid || !active || active.uuid !== interactionUuid) return false;

    const extension = Math.max(0, Number(seconds) || 0);
    if (extension <= 0) return false;

    // If an estimate was already reserved for the asset before execution, do not
    // count the first alert twice. Additional alerts created by macros extend it.
    const elapsed = active.startedAtMs ? Math.max(0, (Date.now() - active.startedAtMs) / 1000) : 0;
    const reservedRemaining = Math.max(0, active.duration - elapsed);
    const actualRemaining = Math.max(0, (active.holdUntilMs - Date.now()) / 1000);
    const alreadyReserved = active.alert_count === 0 && reservedRemaining > 0 && actualRemaining > 0;

    if (!alreadyReserved) {
        active.duration += extension;
        active.holdUntilMs = Math.max(Date.now(), active.holdUntilMs) + extension * 1000;
    }

    active.alert_count += 1;
    logRegular(`extend interaction ${active.name} by ${extension}s${alertUuid ? ` for alert ${alertUuid}` : ""}`);
    notifyInteraction(active, "update");
    notifyQueue();
    return true;
}

export function cancelInteraction(uuid: string | undefined) {
    if (!uuid) return false;

    if (active?.uuid === uuid) {
        finishActiveInteraction("cancelled");
        return true;
    }

    const index = queue.findIndex(item => item.uuid === uuid);
    if (index < 0) return false;

    const [item] = queue.splice(index, 1);
    item.state = "cancelled";
    item.finished_at = new Date().toISOString();
    notifyInteraction(item, "cancel");
    notifyQueue();
    return true;
}
