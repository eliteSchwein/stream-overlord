import {redis} from "../clients/redis/Redis";
import {logDebug, logRegular, logWarn} from "./LogHelper";
import type {CachedClip} from "./RandomClipsHelper";

const CACHE_PREFIX = "streambot:twitch:streamer-clips:";
const MAX_CLIPS = 300;

interface StreamerClipCacheState {
    initialized: boolean;
    refreshing: boolean;
    api: any | null;
    broadcasterId: string;
    channel: string;
    displayName: string;
    updatedAt: number;
    clips: CachedClip[];
}

const state: StreamerClipCacheState = {
    initialized: false,
    refreshing: false,
    api: null,
    broadcasterId: "",
    channel: "",
    displayName: "",
    updatedAt: 0,
    clips: [],
};

function key() {
    return CACHE_PREFIX + state.broadcasterId;
}

function toCachedClip(clip: any): CachedClip {
    return {
        id: String(clip.id ?? ""),
        url: String(clip.url ?? ""),
        embed_url: String(clip.embedUrl ?? ""),
        title: String(clip.title ?? ""),
        broadcaster_id: String(clip.broadcasterId ?? ""),
        broadcaster_name: String(clip.broadcasterDisplayName ?? ""),
        creator_id: String(clip.creatorId ?? ""),
        creator_name: String(clip.creatorDisplayName ?? ""),
        game_id: String(clip.gameId ?? ""),
        language: String(clip.language ?? ""),
        thumbnail_url: String(clip.thumbnailUrl ?? ""),
        duration: Number(clip.duration ?? 0),
        views: Number(clip.views ?? 0),
        video_id: String(clip.videoId ?? ""),
        vod_offset: clip.vodOffset ?? null,
        created_at: clip.creationDate instanceof Date
            ? clip.creationDate.toISOString()
            : String(clip.creationDate ?? ""),
        is_featured: clip.isFeatured === true,
    };
}

async function persist() {
    if (!redis.isReady() || !state.broadcasterId) return;

    try {
        await redis.setVariable(key(), JSON.stringify({
            broadcaster_id: state.broadcasterId,
            channel: state.channel,
            display_name: state.displayName,
            updated_at: state.updatedAt,
            clips: state.clips,
        }));
    } catch (error) {
        logWarn("streamer clip cache: failed to persist redis cache");
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
}

async function restore() {
    if (!redis.isReady() || !state.broadcasterId) return;

    try {
        const raw = await redis.getVariable(key());
        if (!raw) return;

        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed?.clips)) return;

        state.clips = parsed.clips;
        state.updatedAt = Number(parsed.updated_at ?? 0);
        state.initialized = true;

        logRegular(
            `streamer clip cache: restored ${state.clips.length} clips from redis`
        );
    } catch (error) {
        logWarn("streamer clip cache: failed to restore redis cache");
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
}

export async function initStreamerClipCache(api: any, broadcaster: any) {
    if (!api || !broadcaster?.id) return;

    state.api = api;
    state.broadcasterId = String(broadcaster.id);
    state.channel = String(broadcaster.name ?? "").toLowerCase();
    state.displayName = String(broadcaster.displayName ?? broadcaster.name ?? "");

    await restore();
    await refreshStreamerClipCache();
}

export async function refreshStreamerClipCache() {
    if (
        state.refreshing
        || !state.api
        || !state.broadcasterId
    ) {
        return;
    }

    state.refreshing = true;

    try {
        const request = state.api.clips.getClipsForBroadcasterPaginated(
            state.broadcasterId
        );

        const next: CachedClip[] = [];

        for await (const clip of request) {
            next.push(toCachedClip(clip));

            if (next.length >= MAX_CLIPS) {
                break;
            }
        }

        const previousById = new Map(state.clips.map(clip => [clip.id, clip]));
        const nextIds = new Set(next.map(clip => clip.id));

        const created = next.filter(clip => !previousById.has(clip.id));
        const deleted = state.clips.filter(clip => !nextIds.has(clip.id));

        state.clips = next;
        state.updatedAt = Date.now();
        state.initialized = true;

        await persist();

        if (created.length || deleted.length) {
            logRegular(
                `streamer clip cache updated: ${next.length} clips `
                + `(+${created.length}/-${deleted.length})`
            );
        } else {
            logDebug(`streamer clip cache unchanged: ${next.length} clips`);
        }
    } catch (error) {
        logWarn("streamer clip cache refresh failed");
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
    } finally {
        state.refreshing = false;
    }
}

export async function upsertStreamerClip(clip: any) {
    if (!clip?.id) return;

    const normalized = toCachedClip(clip);

    if (
        state.broadcasterId
        && normalized.broadcaster_id
        && normalized.broadcaster_id !== state.broadcasterId
    ) {
        return;
    }

    state.clips = [
        normalized,
        ...state.clips.filter(entry => entry.id !== normalized.id),
    ].slice(0, MAX_CLIPS);

    state.updatedAt = Date.now();
    state.initialized = true;

    await persist();

    logRegular(
        `streamer clip cache: added/updated clip ${normalized.id} `
        + `(${state.clips.length} cached)`
    );
}

export async function removeStreamerClip(id: string) {
    const before = state.clips.length;
    state.clips = state.clips.filter(clip => clip.id !== id);

    if (state.clips.length === before) return;

    state.updatedAt = Date.now();
    await persist();

    logRegular(
        `streamer clip cache: removed clip ${id} `
        + `(${state.clips.length} cached)`
    );
}

export function getStreamerClipCache(channel?: string) {
    if (!state.initialized) return null;

    if (channel) {
        const normalized = channel.trim().replace(/^@/, "").toLowerCase();

        if (
            normalized !== state.channel
            && normalized !== state.displayName.toLowerCase()
        ) {
            return null;
        }
    }

    return {
        broadcaster_id: state.broadcasterId,
        channel: state.channel,
        channel_display_name: state.displayName,
        updated_at: state.updatedAt,
        clips: [...state.clips],
    };
}
