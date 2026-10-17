import {redis} from "../clients/redis/Redis";
import {logWarn} from "./LogHelper";

const REDIS_KEY =
    "streambot:twitch:subscription-cumulative-months";

type SubscriptionDurationEntry = {
    months: number;
    updated_at: number;
};

const durations =
    new Map<string, SubscriptionDurationEntry>();

let loaded = false;

export async function initTwitchSubscriptionDurations() {
    if (loaded) return;
    loaded = true;

    if (!redis.isReady()) return;

    try {
        const raw = await redis.getVariable(REDIS_KEY);
        if (!raw) return;

        const parsed = JSON.parse(raw);

        if (!parsed || typeof parsed !== "object") return;

        for (const [userId, entry] of Object.entries(parsed)) {
            const months = Number((entry as any)?.months);

            if (
                !userId
                || !Number.isFinite(months)
                || months <= 0
            ) {
                continue;
            }

            durations.set(userId, {
                months: Math.floor(months),
                updated_at: Number(
                    (entry as any)?.updated_at
                    ?? Date.now(),
                ),
            });
        }
    } catch (error) {
        logWarn(
            "failed to restore twitch subscription duration cache",
        );
        logWarn(
            JSON.stringify(
                error,
                Object.getOwnPropertyNames(error),
            ),
        );
    }
}

async function persist() {
    if (!redis.isReady()) return;

    try {
        await redis.setVariable(
            REDIS_KEY,
            JSON.stringify(
                Object.fromEntries(durations.entries()),
            ),
        );
    } catch (error) {
        logWarn(
            "failed to persist twitch subscription duration cache",
        );
        logWarn(
            JSON.stringify(
                error,
                Object.getOwnPropertyNames(error),
            ),
        );
    }
}

export function getTwitchSubscriptionMonths(
    userId: string,
): number | null {
    const entry = durations.get(String(userId));

    return entry?.months ?? null;
}

export async function rememberTwitchSubscriptionMonths(
    userId: string,
    months: number,
) {
    const id = String(userId ?? "").trim();
    const value = Math.floor(Number(months));

    if (
        !id
        || !Number.isFinite(value)
        || value <= 0
    ) {
        return;
    }

    const current = durations.get(id);

    // Never replace a known cumulative value with a smaller one.
    if (current && current.months >= value) {
        return;
    }

    durations.set(id, {
        months: value,
        updated_at: Date.now(),
    });

    await persist();
}

export async function rememberTwitchSubscriptionMonthsFromBadgeInfo(
    userId: string,
    badgeInfo: Map<string, string> | null | undefined,
) {
    if (!badgeInfo) return;

    const raw =
        badgeInfo.get("subscriber")
        ?? badgeInfo.get("founder");

    if (!raw) return;

    const months = Number(raw);

    if (!Number.isFinite(months) || months <= 0) {
        return;
    }

    await rememberTwitchSubscriptionMonths(
        userId,
        months,
    );
}

