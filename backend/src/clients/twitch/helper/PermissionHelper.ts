import {Bot} from "@twurple/easy-bot";
import {getConfig} from "../../../helper/ConfigHelper";
import {getTwitchClient} from "../../../App";
import {logWarn} from "../../../helper/LogHelper";

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
    const id = String(channelMod?.userId ?? channelMod?.id ?? "").trim();
    const login = String(
        channelMod?.userName
        ?? channelMod?.userLogin
        ?? channelMod?.name
        ?? "",
    ).trim();
    const displayName = String(
        channelMod?.userDisplayName
        ?? channelMod?.displayName
        ?? login,
    ).trim();

    return {
        channel,
        twitch_user_id: id,
        login,
        display_name: displayName,
    };
}

async function loadChannelPermissions(bot: Bot, channel: string) {
    moderators[channel] = [];
    moderatorDetails[channel] = [];
    vips[channel] = [];

    const channelMods = await bot.getMods(channel);
    const channelVips = await bot.getVips(channel);

    for (const channelMod of channelMods as any[]) {
        const moderator = normalizeModerator(channel, channelMod);
        if (!moderator.twitch_user_id) continue;
        moderators[channel].push(moderator.twitch_user_id);
        moderatorDetails[channel].push(moderator);
    }

    for (const channelVip of channelVips as any[]) {
        const id = String(channelVip?.id ?? channelVip?.userId ?? "").trim();
        if (id) vips[channel].push(id);
    }
}

export default async function registerPermissions(bot: Bot|undefined) {
    if(!bot) return;

    const channels = getConfig(/twitch/g)[0]['channels'];

    for(const channel of channels) {
        await loadChannelPermissions(bot, channel);
    }

    notifyModeratorUpdate();
}

export async function resetChannelPermissions(channel: string) {
    const bot = getTwitchClient().getBot();

    moderators[channel] = [];
    moderatorDetails[channel] = [];
    vips[channel] = [];

    if(!bot) {
        notifyModeratorUpdate();
        return;
    }

    await loadChannelPermissions(bot, channel);
    notifyModeratorUpdate();
}

export async function addModeratorsToChannelFromExternal(channel: string, fromChannel: string) {
    const bot = getTwitchClient().getBot();

    if(!moderators[channel]) moderators[channel] = [];
    if(!moderatorDetails[channel]) moderatorDetails[channel] = [];

    if(!moderators[channel].includes(fromChannel)) {
        moderators[channel].push(fromChannel);
    }

    if(!bot) {
        notifyModeratorUpdate();
        return;
    }

    const channelMods = await bot.getMods(fromChannel);

    for(const channelMod of channelMods as any[]) {
        const moderator = normalizeModerator(channel, channelMod);
        if (!moderator.twitch_user_id) continue;
        if(moderators[channel].includes(moderator.twitch_user_id)) continue;
        moderators[channel].push(moderator.twitch_user_id);
        moderatorDetails[channel].push(moderator);
    }

    notifyModeratorUpdate();
}

export function registerPermissionInterval(bot: Bot|undefined) {
    setInterval(() => {
        void registerPermissions(bot).catch(error => {
            logWarn("twitch permission refresh failed:");
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        });
    }, 60 * 1000);
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
    if(!vips[channel]) return false;
    return vips[channel].includes(`${userId}`);
}

export function hasModerator(channel: string, userId: string): boolean {
    if(!moderators[channel]) return false;
    return moderators[channel].includes(`${userId}`);
}
