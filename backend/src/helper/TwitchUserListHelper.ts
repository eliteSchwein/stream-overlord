import {getPrimaryChannel} from "./ConfigHelper";
import {getTwitchClient} from "../App";
import {hasModerator, hasVip} from "../clients/twitch/helper/PermissionHelper";
import {logDebug, logWarn} from "./LogHelper";

export type TwitchUserListEntry = {
    id: string;
    login: string;
    display_name: string;
};

export type TwitchUserListPayload = {
    channel: string;
    updated_at: number;
    total: number;
    streamer: TwitchUserListEntry[];
    moderator: TwitchUserListEntry[];
    vips: TwitchUserListEntry[];
    normal: TwitchUserListEntry[];
};

let cachedChatters: TwitchUserListEntry[] = [];
let cachedPayload: TwitchUserListPayload = {
    channel: "",
    updated_at: 0,
    total: 0,
    streamer: [],
    moderator: [],
    vips: [],
    normal: [],
};

let refreshing = false;
let notifier: ((payload: TwitchUserListPayload) => void) | undefined;

export function setTwitchUserListNotifier(
    callback?: (payload: TwitchUserListPayload) => void,
) {
    notifier = callback;
}

function normalizeUser(user: any): TwitchUserListEntry {
    return {
        id: String(
            user?.userId
            ?? user?.id
            ?? user?.user_id
            ?? "",
        ),
        login: String(
            user?.userName
            ?? user?.name
            ?? user?.user_name
            ?? "",
        ),
        display_name: String(
            user?.userDisplayName
            ?? user?.displayName
            ?? user?.user_name
            ?? user?.userName
            ?? "",
        ),
    };
}

function buildPayload(): TwitchUserListPayload {
    const primaryChannel: any = getPrimaryChannel();
    const channelName = String(
        primaryChannel?.name ?? "",
    ).toLowerCase();
    const broadcasterId = String(
        primaryChannel?.id ?? "",
    );

    const streamer: TwitchUserListEntry[] = [];
    const moderator: TwitchUserListEntry[] = [];
    const vips: TwitchUserListEntry[] = [];
    const normal: TwitchUserListEntry[] = [];

    for (const user of cachedChatters) {
        if (!user.id) continue;

        if (user.id === broadcasterId) {
            streamer.push(user);
            continue;
        }

        if (hasModerator(channelName, user.id)) {
            moderator.push(user);
            continue;
        }

        if (hasVip(channelName, user.id)) {
            vips.push(user);
            continue;
        }

        normal.push(user);
    }

    const byName = (
        a: TwitchUserListEntry,
        b: TwitchUserListEntry,
    ) => a.display_name.localeCompare(
        b.display_name,
        undefined,
        {sensitivity: "base"},
    );

    streamer.sort(byName);
    moderator.sort(byName);
    vips.sort(byName);
    normal.sort(byName);

    return {
        channel: channelName,
        updated_at: Date.now(),
        total: cachedChatters.length,
        streamer,
        moderator,
        vips,
        normal,
    };
}

function comparable(payload: TwitchUserListPayload) {
    return {
        channel: payload.channel,
        total: payload.total,
        streamer: payload.streamer,
        moderator: payload.moderator,
        vips: payload.vips,
        normal: payload.normal,
    };
}

function publishIfChanged() {
    const next = buildPayload();

    if (
        JSON.stringify(comparable(next))
        === JSON.stringify(comparable(cachedPayload))
    ) {
        cachedPayload = {
            ...cachedPayload,
            updated_at: next.updated_at,
        };
        return;
    }

    cachedPayload = next;

    try {
        notifier?.(getTwitchUserListPayload());
    } catch (error) {
        logWarn("failed to notify twitch user list update");
        logWarn(
            JSON.stringify(
                error,
                Object.getOwnPropertyNames(error),
            ),
        );
    }
}

export async function refreshTwitchUserList() {
    if (refreshing) return;

    const bot = getTwitchClient()?.getBot?.();
    const primaryChannel: any = getPrimaryChannel();

    if (!bot?.api || !primaryChannel?.id) return;

    refreshing = true;

    try {
        const chatters =
            await bot.api.chat
                .getChattersPaginated(primaryChannel.id)
                .getAll();

        const deduplicated =
            new Map<string, TwitchUserListEntry>();

        for (const chatter of chatters as any[]) {
            const user = normalizeUser(chatter);
            if (!user.id) continue;
            deduplicated.set(user.id, user);
        }

        cachedChatters = [...deduplicated.values()];
        publishIfChanged();

        logDebug(
            `twitch user list refreshed: ${cachedChatters.length} chatter(s)`,
        );
    } catch (error) {
        logWarn(
            "twitch user list refresh failed; keeping cached user list",
        );
        logWarn(
            JSON.stringify(
                error,
                Object.getOwnPropertyNames(error),
            ),
        );
    } finally {
        refreshing = false;
    }
}

/**
 * Re-categorize the already cached chatter list after a mod/VIP role change.
 * This avoids another Twitch API call just because a role changed.
 */
export function refreshTwitchUserListRoles() {
    if (!cachedChatters.length) return;
    publishIfChanged();
}

export function getTwitchUserListPayload(): TwitchUserListPayload {
    return {
        channel: cachedPayload.channel,
        updated_at: cachedPayload.updated_at,
        total: cachedPayload.total,
        streamer: cachedPayload.streamer.map(user => ({...user})),
        moderator: cachedPayload.moderator.map(user => ({...user})),
        vips: cachedPayload.vips.map(user => ({...user})),
        normal: cachedPayload.normal.map(user => ({...user})),
    };
}
