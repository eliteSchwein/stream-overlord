import {Bot} from "@twurple/easy-bot";
import {getConfig} from "../../../helper/ConfigHelper";
import {getTwitchClient} from "../../../App";
import {logRegular, logWarn} from "../../../helper/LogHelper";

type ModeratorInfo = {
    channel: string;
    twitch_user_id: string;
    login: string;
    display_name: string;
};

const moderators: Record<string, string[]> = {};
const moderatorDetails: Record<string, ModeratorInfo[]> = {};
const vips: Record<string, string[]> = {};

let moderatorUpdateNotifier: (() => void) | undefined;

export function setModeratorUpdateNotifier(callback?: () => void) {
    moderatorUpdateNotifier = callback;
}

function notifyModeratorUpdate() {
    try {
        moderatorUpdateNotifier?.();
    } catch (error) {
        logWarn("failed to notify moderator update");
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
}

function normalizeModerator(channel: string, channelMod: any): ModeratorInfo {
    const id = String(
        channelMod?.userId
        ?? channelMod?.id
        ?? channelMod?.user_id
        ?? "",
    ).trim();
    const login = String(
        channelMod?.userName
        ?? channelMod?.userLogin
        ?? channelMod?.name
        ?? channelMod?.user_name
        ?? "",
    ).trim();
    const displayName = String(
        channelMod?.userDisplayName
        ?? channelMod?.displayName
        ?? channelMod?.user_name
        ?? login,
    ).trim();

    return {
        channel,
        twitch_user_id: id,
        login,
        display_name: displayName,
    };
}

function normalizeVipId(channelVip: any): string {
    return String(
        channelVip?.userId
        ?? channelVip?.id
        ?? channelVip?.user_id
        ?? "",
    ).trim();
}

/**
 * Fetch into temporary arrays and only replace the live cache after every
 * request succeeds. A temporary Twitch/network outage must never turn a
 * last-known-good permission cache into an empty one.
 */
async function loadChannelPermissions(bot: Bot, channel: string) {
    const channelMods = await bot.getMods(channel);
    const channelVips = await bot.getVips(channel);

    const nextModerators: string[] = [];
    const nextModeratorDetails: ModeratorInfo[] = [];
    const nextVips: string[] = [];

    for (const channelMod of channelMods as any[]) {
        const moderator = normalizeModerator(channel, channelMod);
        if (!moderator.twitch_user_id) continue;
        if (nextModerators.includes(moderator.twitch_user_id)) continue;

        nextModerators.push(moderator.twitch_user_id);
        nextModeratorDetails.push(moderator);
    }

    for (const channelVip of channelVips as any[]) {
        const id = normalizeVipId(channelVip);
        if (!id || nextVips.includes(id)) continue;
        nextVips.push(id);
    }

    moderators[channel] = nextModerators;
    moderatorDetails[channel] = nextModeratorDetails;
    vips[channel] = nextVips;

    logRegular(
        `twitch permissions loaded for ${channel}: `
        + `${nextModerators.length} moderator(s), ${nextVips.length} vip(s)`,
    );
}

export default async function registerPermissions(bot: Bot|undefined) {
    if (!bot) {
        logWarn("twitch permission refresh skipped: bot unavailable; keeping cached permissions");
        return;
    }

    const channels = getConfig(/twitch/g)[0]['channels'];
    let changed = false;

    for (const channel of channels) {
        try {
            await loadChannelPermissions(bot, channel);
            changed = true;
        } catch (error) {
            logWarn(`twitch permission refresh failed for ${channel}; keeping last known permissions`);
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        }
    }

    if (changed) notifyModeratorUpdate();
}

export async function resetChannelPermissions(channel: string) {
    const bot = getTwitchClient().getBot();

    if (!bot) {
        logWarn(`twitch permission reset skipped for ${channel}: bot unavailable; keeping cached permissions`);
        return;
    }

    try {
        await loadChannelPermissions(bot, channel);
        notifyModeratorUpdate();
    } catch (error) {
        logWarn(`twitch permission reset failed for ${channel}; keeping last known permissions`);
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
}

export async function addModeratorsToChannelFromExternal(channel: string, fromChannel: string) {
    const bot = getTwitchClient().getBot();

    if (!moderators[channel]) moderators[channel] = [];
    if (!moderatorDetails[channel]) moderatorDetails[channel] = [];

    if (!bot) {
        logWarn(`shared-chat moderator sync skipped for ${fromChannel}: bot unavailable`);
        return;
    }

    try {
        const channelMods = await bot.getMods(fromChannel);
        let changed = false;

        for (const channelMod of channelMods as any[]) {
            const moderator = normalizeModerator(channel, channelMod);
            if (!moderator.twitch_user_id) continue;
            if (moderators[channel].includes(moderator.twitch_user_id)) continue;

            moderators[channel].push(moderator.twitch_user_id);
            moderatorDetails[channel].push(moderator);
            changed = true;
        }

        if (changed) notifyModeratorUpdate();
    } catch (error) {
        logWarn(`shared-chat moderator sync failed for ${fromChannel}; keeping existing permissions`);
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
}

export function addModeratorPermission(channel: string, event: any) {
    if (!moderators[channel]) moderators[channel] = [];
    if (!moderatorDetails[channel]) moderatorDetails[channel] = [];

    const moderator = normalizeModerator(channel, event);
    if (!moderator.twitch_user_id) return;

    let changed = false;

    if (!moderators[channel].includes(moderator.twitch_user_id)) {
        moderators[channel].push(moderator.twitch_user_id);
        changed = true;
    }

    const existingIndex = moderatorDetails[channel]
        .findIndex(entry => entry.twitch_user_id === moderator.twitch_user_id);

    if (existingIndex >= 0) {
        moderatorDetails[channel][existingIndex] = moderator;
    } else {
        moderatorDetails[channel].push(moderator);
        changed = true;
    }

    if (changed) notifyModeratorUpdate();
}

export function removeModeratorPermission(channel: string, event: any) {
    const userId = String(event?.userId ?? event?.id ?? event?.user_id ?? "").trim();
    if (!userId) return;

    const oldModeratorCount = moderators[channel]?.length ?? 0;
    const oldDetailCount = moderatorDetails[channel]?.length ?? 0;

    moderators[channel] = (moderators[channel] ?? []).filter(id => id !== userId);
    moderatorDetails[channel] = (moderatorDetails[channel] ?? [])
        .filter(entry => entry.twitch_user_id !== userId);

    if (
        moderators[channel].length !== oldModeratorCount
        || moderatorDetails[channel].length !== oldDetailCount
    ) {
        notifyModeratorUpdate();
    }
}

export function addVipPermission(channel: string, event: any) {
    if (!vips[channel]) vips[channel] = [];

    const userId = String(event?.userId ?? event?.id ?? event?.user_id ?? "").trim();
    if (!userId || vips[channel].includes(userId)) return;

    vips[channel].push(userId);
    notifyModeratorUpdate();
}

export function removeVipPermission(channel: string, event: any) {
    const userId = String(event?.userId ?? event?.id ?? event?.user_id ?? "").trim();
    if (!userId) return;

    const before = vips[channel]?.length ?? 0;
    vips[channel] = (vips[channel] ?? []).filter(id => id !== userId);

    if (vips[channel].length !== before) notifyModeratorUpdate();
}

export function getModeratorsForCloud(): ModeratorInfo[] {
    const deduplicated = new Map<string, ModeratorInfo>();

    for (const entries of Object.values(moderatorDetails)) {
        for (const moderator of entries) {
            if (!moderator.twitch_user_id) continue;
            const current = deduplicated.get(moderator.twitch_user_id);
            if (!current || (!current.login && moderator.login)) {
                deduplicated.set(moderator.twitch_user_id, moderator);
            }
        }
    }

    return [...deduplicated.values()];
}

export function hasVip(channel: string, userId: string): boolean {
    if (!vips[channel]) return false;
    return vips[channel].includes(`${userId}`);
}

export function hasModerator(channel: string, userId: string): boolean {
    if (!moderators[channel]) return false;
    return moderators[channel].includes(`${userId}`);
}
