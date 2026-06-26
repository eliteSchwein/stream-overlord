import type { Bot } from "@twurple/easy-bot";
import { getConfig } from "./ConfigHelper";
import { logRegular, logWarn } from "./LogHelper";

type TwitchDataCache = {
    channel?: any;
    stream?: any;
    category?: any;
};

const twitchData: TwitchDataCache = {};

function parseUser(user: any) {
    if (!user) return undefined;

    return {
        id: user.id,
        name: user.name,
        display_name: user.displayName,
        description: user.description,
        profile_picture_url: user.profilePictureUrl,
        offline_placeholder_url: user.offlinePlaceholderUrl,
        creation_date: user.creationDate?.toISOString?.() ?? user.creationDate,
        type: user.type,
        broadcaster_type: user.broadcasterType,
    };
}

function parseStream(stream: any) {
    if (!stream) return undefined;

    return {
        id: stream.id,
        user_id: stream.userId,
        user_name: stream.userName,
        user_display_name: stream.userDisplayName,
        game_id: stream.gameId,
        game_name: stream.gameName,
        title: stream.title,
        type: stream.type,
        start_date: stream.startDate?.toISOString?.() ?? stream.startDate,
        viewers: stream.viewers,
        language: stream.language,
        thumbnail_url: stream.thumbnailUrl,
        tags: stream.tags ?? [],
        is_mature: stream.isMature,
    };
}

function parseCategory(category: any) {
    if (!category) return undefined;

    return {
        id: category.id,
        name: category.name,
        box_art_url: category.boxArtUrl,
    };
}

export function getCachedTwitchData() {
    return twitchData;
}

export function getCachedTwitchChannel() {
    return twitchData.channel;
}

export function getCachedTwitchStream() {
    return twitchData.stream;
}

export function getCachedTwitchCategory() {
    return twitchData.category;
}

export async function updateTwitchChannelData(bot: Bot) {
    logRegular("update twitch channel data");

    const channelName = getConfig(/twitch/g)[0]?.channels?.[0];

    if (!channelName) {
        logWarn("twitch channel update skipped: no primary channel configured");
        return twitchData.channel;
    }

    const user = await bot.api.users.getUserByName(channelName);
    twitchData.channel = parseUser(user);

    return twitchData.channel;
}

export async function updateTwitchStreamData(bot: Bot) {
    logRegular("update twitch stream data");

    if (!twitchData.channel?.id) {
        await updateTwitchChannelData(bot);
    }

    if (!twitchData.channel?.id) {
        logWarn("twitch stream update skipped: no cached channel");
        return undefined;
    }

    const stream = await bot.api.streams.getStreamByUserId(twitchData.channel.id);
    twitchData.stream = parseStream(stream);

    return twitchData.stream;
}

export async function updateTwitchCategoryData(bot: Bot) {
    logRegular("update twitch category data");

    if (!twitchData.stream?.game_id) {
        await updateTwitchStreamData(bot);
    }

    if (!twitchData.stream?.game_id) {
        twitchData.category = undefined;
        return undefined;
    }

    const category = await bot.api.games.getGameById(twitchData.stream.game_id);
    twitchData.category = parseCategory(category);

    return twitchData.category;
}

export async function updateTwitchData(bot: Bot) {
    await updateTwitchChannelData(bot);
    await updateTwitchStreamData(bot);
    await updateTwitchCategoryData(bot);

    return twitchData;
}