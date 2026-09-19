import getWebsocketServer from "../App";
import {logRegular, logWarn} from "./LogHelper";
import {triggerConfiguredEvent} from "./EventHelper";
import {redis} from "../clients/redis/Redis";
import {getGiveawaySettings} from "./ConfigHelper";

const REDIS_KEY = "giveaway_state";

type GiveawayUser = {
    id: string;
    name: string;
    displayName: string;
    profilePictureUrl?: string;
};

type GiveawayState = {
    winner?: GiveawayUser;
    giveawayText: string;
    users: GiveawayUser[];
    interval: number;
    currentInterval: number;
    active: boolean;
    endsAt: number;
    lastProgressEventAt: number;
};

const giveaway: GiveawayState = {
    winner: undefined,
    giveawayText: "",
    users: [],
    interval: 0,
    currentInterval: 0,
    active: false,
    endsAt: 0,
    lastProgressEventAt: 0,
};

function publicUser(user: any): GiveawayUser {
    return {
        id: String(user?.id ?? ""),
        name: String(user?.name ?? ""),
        displayName: String(user?.displayName ?? user?.name ?? ""),
        ...(user?.profilePictureUrl ? {profilePictureUrl: String(user.profilePictureUrl)} : {}),
    };
}

async function persistGiveaway() {
    if (!redis.isReady()) return;
    try {
        await redis.setVariable(REDIS_KEY, JSON.stringify(giveaway));
    } catch (error: any) {
        logWarn(`failed to persist giveaway: ${error?.message ?? error}`);
    }
}

async function clearPersistedGiveaway() {
    if (!redis.isReady()) return;
    try {
        await redis.deleteVariable(REDIS_KEY);
    } catch (error: any) {
        logWarn(`failed to clear persisted giveaway: ${error?.message ?? error}`);
    }
}

export async function initGiveaway() {
    if (!redis.isReady()) return;

    try {
        const raw = await redis.getVariable(REDIS_KEY);
        if (!raw) return;

        const restored = JSON.parse(raw);
        if (!restored || typeof restored !== "object") return;

        giveaway.giveawayText = String(restored.giveawayText ?? restored.content ?? "");
        giveaway.users = Array.isArray(restored.users) ? restored.users.map(publicUser).filter((u: GiveawayUser) => u.id) : [];
        giveaway.winner = restored.winner ? publicUser(restored.winner) : undefined;
        giveaway.interval = Math.max(0, Number(restored.interval ?? 0) || 0);
        giveaway.endsAt = Math.max(0, Number(restored.endsAt ?? 0) || 0);
        giveaway.lastProgressEventAt = Math.max(0, Number(restored.lastProgressEventAt ?? 0) || 0);

        const remaining = giveaway.endsAt > 0
            ? Math.max(0, Math.ceil((giveaway.endsAt - Date.now()) / 1000))
            : Math.max(0, Number(restored.currentInterval ?? 0) || 0);

        giveaway.currentInterval = remaining;
        giveaway.active = restored.active === true && remaining > 0 && !!giveaway.giveawayText;

        if (!giveaway.active) {
            await clearPersistedGiveaway();
            resetGiveawayState();
            return;
        }

        if (giveaway.active) {
            logRegular(`restored active giveaway with ${remaining}s remaining`);
            notifyGiveaway();
        }
    } catch (error: any) {
        logWarn(`failed to restore giveaway: ${error?.message ?? error}`);
    }
}

function notifyGiveaway() {
    try {
        getWebsocketServer()?.send("notify_giveaway_update", getGiveaway());
    } catch (_) {}
}

function resetGiveawayState() {
    giveaway.currentInterval = 0;
    giveaway.interval = 0;
    giveaway.users = [];
    giveaway.winner = undefined;
    giveaway.giveawayText = "";
    giveaway.active = false;
    giveaway.endsAt = 0;
    giveaway.lastProgressEventAt = 0;
    notifyGiveaway();
}

export function hasGiveawayUser(user: {id: string}): boolean {
    return giveaway.users.some(u => u.id === user.id);
}

export async function removeGiveawayUser(user: {id: string}): Promise<void> {
    const i = giveaway.users.findIndex(u => u.id === user.id);
    if (i !== -1) giveaway.users.splice(i, 1);
    notifyGiveaway();
    await persistGiveaway();
}

export async function addGiveawayUser(user: any) {
    if (!giveaway.active) return false;

    const normalizedUser = publicUser(user);
    if (!normalizedUser.id || hasGiveawayUser(normalizedUser)) return false;

    giveaway.users.push(normalizedUser);
    notifyGiveaway();
    await persistGiveaway();

    const event = {
        userId: normalizedUser.id,
        userName: normalizedUser.name,
        userDisplayName: normalizedUser.displayName,
        giveawayText: giveaway.giveawayText,
        totalEntries: giveaway.users.length,
        giveawayCommand: getGiveawaySettings().giveawayCommand,
    };
    void triggerConfiguredEvent("event_giveaway_register", {
        giveaway: getGiveaway(),
        user: normalizedUser,
        ...event,
        event,
    });

    return true;
}

export async function startGiveaway(giveawayText: string, duration: number) {
    await stopGiveaway("restarted", false);

    const seconds = Math.max(1, Math.floor(Number(duration) * 60));
    giveaway.interval = seconds;
    giveaway.currentInterval = seconds;
    giveaway.giveawayText = String(giveawayText ?? "");
    giveaway.active = true;
    giveaway.endsAt = Date.now() + seconds * 1000;
    giveaway.lastProgressEventAt = Date.now();

    logRegular(`giveaway started with text: ${giveaway.giveawayText} and duration: ${duration}`);
    notifyGiveaway();
    await persistGiveaway();

    const event = {
        giveawayText: giveaway.giveawayText,
        durationSeconds: seconds,
        durationMinutes: seconds / 60,
        endsAt: giveaway.endsAt,
        totalEntries: 0,
        giveawayCommand: getGiveawaySettings().giveawayCommand,
    };
    void triggerConfiguredEvent("event_giveaway_start", {
        giveaway: getGiveaway(),
        ...event,
        event,
    });
}

export async function stopGiveaway(reason: "cancelled" | "restarted" | "cleanup" = "cancelled", triggerEvent = false) {
    const wasActive = giveaway.active;
    const giveawayState = getGiveaway();

    if (wasActive) {
        logRegular("giveaway stopped");

        if (triggerEvent) {
            const event = {
                reason,
                giveawayText: giveawayState.giveawayText,
                totalEntries: giveawayState.users.length,
                winnerId: giveawayState.winner?.id ?? "",
                winnerName: giveawayState.winner?.name ?? "",
                winnerDisplayName: giveawayState.winner?.displayName ?? "",
            };
            void triggerConfiguredEvent("event_giveaway_end", {
                giveaway: giveawayState,
                winner: giveawayState.winner ?? null,
                ...event,
                event,
            });
        }
    }

    resetGiveawayState();
    await clearPersistedGiveaway();
}

export async function updateGiveaway() {
    if (!giveaway.active) return;

    giveaway.currentInterval = giveaway.endsAt > 0
        ? Math.max(0, Math.ceil((giveaway.endsAt - Date.now()) / 1000))
        : Math.max(0, giveaway.currentInterval - 1);

    if (giveaway.currentInterval <= 0) {
        giveaway.active = false;

        if (giveaway.users.length === 0) {
            logRegular("giveaway finished without winner");
            giveaway.winner = undefined;
        } else {
            giveaway.winner = giveaway.users[Math.floor(Math.random() * giveaway.users.length)];
            logRegular(`giveaway finished with winner: ${giveaway.winner.name}`);
        }

        const finishedState = getGiveaway();
        const event = {
            reason: "finished",
            giveawayText: finishedState.giveawayText,
            totalEntries: finishedState.users.length,
            winnerId: finishedState.winner?.id ?? "",
            winnerName: finishedState.winner?.name ?? "",
            winnerDisplayName: finishedState.winner?.displayName ?? "",
        };
        void triggerConfiguredEvent("event_giveaway_end", {
            giveaway: finishedState,
            winner: finishedState.winner ?? null,
            ...event,
            event,
        });

        await persistGiveaway();
        notifyGiveaway();

        setTimeout(async () => {
            await stopGiveaway("cleanup", false);
        }, 300_000);
        return;
    }

    const progressInterval = getGiveawaySettings().progress_interval_seconds;
    if (progressInterval > 0 && Date.now() - giveaway.lastProgressEventAt >= progressInterval * 1000) {
        giveaway.lastProgressEventAt = Date.now();
        const progress = giveaway.interval > 0
            ? Math.max(0, Math.min(1, 1 - giveaway.currentInterval / giveaway.interval))
            : 0;

        const event = {
            giveawayText: giveaway.giveawayText,
            remainingSeconds: giveaway.currentInterval,
            totalSeconds: giveaway.interval,
            progress,
            totalEntries: giveaway.users.length,
            endsAt: giveaway.endsAt,
            giveawayCommand: getGiveawaySettings().giveawayCommand,
        };
        void triggerConfiguredEvent("event_giveaway_progress", {
            giveaway: getGiveaway(),
            ...event,
            event,
        });
    }

    notifyGiveaway();
    await persistGiveaway();
}

export function getGiveawayWinner() { return giveaway.winner; }
export function isGiveawayActive() { return giveaway.active; }

export function getGiveaway() {
    return {
        ...giveaway,
        users: giveaway.users.map(user => ({...user})),
        ...(giveaway.winner ? {winner: {...giveaway.winner}} : {winner: undefined}),
        settings: {...getGiveawaySettings()},
    };
}
