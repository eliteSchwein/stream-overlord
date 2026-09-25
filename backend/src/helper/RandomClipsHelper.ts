import {logDebug, logRegular, logWarn} from "./LogHelper";
import {redis} from "../clients/redis/Redis";

type PlaybackMode = "single" | "rotate";
type SelectionMode = "random" | "top";

const CLIP_CACHE_PREFIX = "streambot:random-clips:";
const CLIP_CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CLIP_POOL_SIZE = 300;
const RECENT_HISTORY_SIZE = 10;

export interface RandomClipOptions {
    channel: string;
    playbackMode: PlaybackMode;
    selectionMode: SelectionMode;
    volume: number;
    maxLength: number;
    filterLongVideos: boolean;
    showInfo: boolean;
    showTimer: boolean;
    recentClipsDays: number;
}

export interface CachedClip {
    id: string;
    url: string;
    embed_url: string;
    title: string;
    broadcaster_id: string;
    broadcaster_name: string;
    creator_id: string;
    creator_name: string;
    game_id: string;
    language: string;
    thumbnail_url: string;
    duration: number;
    views: number;
    video_id: string;
    vod_offset: number | null;
    created_at: string;
    is_featured: boolean;
}

interface CachedClipPool {
    cached_at: number;
    channel: string;
    channel_display_name: string;
    clips: CachedClip[];
}

interface RuntimeState {
    generation: number;
    active: boolean;
    timer: ReturnType<typeof setTimeout> | null;
    options: RandomClipOptions | null;
    clips: CachedClip[];
    recentIds: string[];
    channelName: string;
    channelDisplayName: string;
}

const state: RuntimeState = {
    generation: 0,
    active: false,
    timer: null,
    options: null,
    clips: [],
    recentIds: [],
    channelName: "",
    channelDisplayName: "",
};

function clearTimer() {
    if (!state.timer) return;

    clearTimeout(state.timer);
    state.timer = null;
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function normalizeChannel(channel: string) {
    return channel.trim().replace(/^@/, "").toLowerCase();
}

function cacheKey(channel: string, recentClipsDays: number) {
    return (
        CLIP_CACHE_PREFIX
        + encodeURIComponent(normalizeChannel(channel))
        + `:days:${Math.max(0, recentClipsDays)}`
    );
}

function twitchClipToCachedClip(clip: any): CachedClip {
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
        created_at:
            clip.creationDate instanceof Date
                ? clip.creationDate.toISOString()
                : String(clip.creationDate ?? ""),
        is_featured: clip.isFeatured === true,
    };
}

async function readCachedClipPool(
    channel: string,
    recentClipsDays: number,
): Promise<CachedClipPool | null> {
    if (!redis.isReady()) {
        return null;
    }

    try {
        const raw = await redis.getVariable(
            cacheKey(channel, recentClipsDays)
        );

        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw) as CachedClipPool;

        if (
            !parsed
            || typeof parsed.cached_at !== "number"
            || !Array.isArray(parsed.clips)
        ) {
            return null;
        }

        if (Date.now() - parsed.cached_at > CLIP_CACHE_TTL_MS) {
            return null;
        }

        logDebug(
            `random clips: redis cache hit for ${channel} `
            + `(${parsed.clips.length} clips)`
        );

        return parsed;
    } catch (error) {
        logWarn("random clips: failed to read redis clip cache");
        logWarn(
            JSON.stringify(
                error,
                Object.getOwnPropertyNames(error)
            )
        );

        return null;
    }
}

async function writeCachedClipPool(
    channel: string,
    recentClipsDays: number,
    pool: CachedClipPool,
) {
    if (!redis.isReady()) {
        return;
    }

    try {
        await redis.setVariable(
            cacheKey(channel, recentClipsDays),
            JSON.stringify(pool)
        );

        logDebug(
            `random clips: cached ${pool.clips.length} clips `
            + `for ${channel} in redis`
        );
    } catch (error) {
        logWarn("random clips: failed to write redis clip cache");
        logWarn(
            JSON.stringify(
                error,
                Object.getOwnPropertyNames(error)
            )
        );
    }
}

async function fetchClipPool(
    api: any,
    channel: string,
    recentClipsDays: number,
): Promise<CachedClipPool> {
    const normalizedChannel = normalizeChannel(channel);

    const cached = await readCachedClipPool(
        normalizedChannel,
        recentClipsDays
    );

    if (cached) {
        return cached;
    }

    const user = await api.users.getUserByName(normalizedChannel);

    if (!user) {
        throw new Error(
            `Twitch channel not found: ${normalizedChannel}`
        );
    }

    const filter: Record<string, any> = {};

    if (recentClipsDays > 0) {
        filter.startDate = new Date(
            Date.now()
            - recentClipsDays * 24 * 60 * 60 * 1000
        ).toISOString();

        filter.endDate = new Date().toISOString();
    }

    const request =
        api.clips.getClipsForBroadcasterPaginated(
            user.id,
            filter
        );

    const clips: CachedClip[] = [];

    for await (const clip of request) {
        clips.push(
            twitchClipToCachedClip(clip)
        );

        if (clips.length >= MAX_CLIP_POOL_SIZE) {
            break;
        }
    }

    const pool: CachedClipPool = {
        cached_at: Date.now(),
        channel: String(
            user.name
            ?? normalizedChannel
        ),
        channel_display_name: String(
            user.displayName
            ?? user.name
            ?? normalizedChannel
        ),
        clips,
    };

    await writeCachedClipPool(
        normalizedChannel,
        recentClipsDays,
        pool
    );

    return pool;
}

function rememberClip(id: string) {
    if (!id) return;

    state.recentIds =
        state.recentIds.filter(
            entry => entry !== id
        );

    state.recentIds.push(id);

    if (
        state.recentIds.length
        > RECENT_HISTORY_SIZE
    ) {
        state.recentIds.splice(
            0,
            state.recentIds.length
            - RECENT_HISTORY_SIZE
        );
    }
}

function getEligibleClips(
    clips: CachedClip[],
    options: RandomClipOptions,
) {
    if (!options.filterLongVideos) {
        return clips;
    }

    return clips.filter(
        clip =>
            clip.duration <= options.maxLength
    );
}

function selectClip(): CachedClip | null {
    if (
        !state.clips.length
        || !state.options
    ) {
        return null;
    }

    let available =
        state.clips.filter(
            clip =>
                !state.recentIds.includes(clip.id)
        );

    if (!available.length) {
        state.recentIds = [];
        available = [...state.clips];
    }

    if (!available.length) {
        return null;
    }

    if (
        state.options.selectionMode
        === "top"
    ) {
        return available[0];
    }

    return available[
        Math.floor(
            Math.random()
            * available.length
        )
    ];
}

function playbackSeconds(
    clip: CachedClip,
    options: RandomClipOptions,
) {
    const clipDuration =
        Math.max(
            1,
            Number(clip.duration || 1)
        );

    return Math.max(
        1,
        Math.min(
            clipDuration,
            options.maxLength
        )
    );
}

function buildMediaUrl(
    clip: CachedClip,
) {
    return (
        `/api/random-clips/media/`
        + encodeURIComponent(clip.id)
    );
}

function buildPayloadClip(
    clip: CachedClip,
) {
    return {
        id: clip.id,
        title: clip.title,
        media_url: buildMediaUrl(clip),
        duration: clip.duration,
        broadcaster_name:
            clip.broadcaster_name,
        creator_name:
            clip.creator_name,
        thumbnail_url:
            clip.thumbnail_url,
    };
}

function sendClip(
    websocket: any,
    clip: CachedClip,
    options: RandomClipOptions,
) {
    const seconds =
        playbackSeconds(
            clip,
            options
        );

    websocket.send(
        "notify_random_clips",
        {
            action: "play",

            clip:
                buildPayloadClip(clip),

            volume:
                options.volume,

            info:
                options.showInfo,

            show_timer:
                options.showTimer,

            playback_seconds:
                seconds,
        }
    );

    return seconds;
}

async function playNext(
    websocket: any,
    generation: number,
) {
    if (
        !state.active
        || generation !== state.generation
        || !state.options
    ) {
        return;
    }

    const clip = selectClip();

    if (!clip) {
        logWarn(
            `random clips: no eligible clips `
            + `for ${state.channelName}`
        );

        disableRandomClips(websocket);
        return;
    }

    rememberClip(clip.id);

    const seconds =
        sendClip(
            websocket,
            clip,
            state.options
        );

    logRegular(
        `random clips: play ${clip.id} `
        + `(${seconds}s) from `
        + `${state.channelDisplayName}`
    );

    clearTimer();

    state.timer = setTimeout(
        () => {
            if (
                !state.active
                || generation
                    !== state.generation
                || !state.options
            ) {
                return;
            }

            if (
                state.options.playbackMode
                === "single"
            ) {
                state.active = false;
                state.timer = null;

                websocket.send(
                    "notify_random_clips",
                    {
                        action: "disable",
                        reason: "finished",
                    }
                );

                return;
            }

            void playNext(
                websocket,
                generation
            );
        },
        Math.ceil(
            seconds * 1000
        )
    );

    state.timer.unref?.();
}

export async function enableRandomClips(
    api: any,
    websocket: any,
    options: RandomClipOptions,
): Promise<CachedClip | null> {
    disableRandomClips(
        websocket,
        false
    );

    const generation =
        ++state.generation;

    const normalized:
        RandomClipOptions = {
        ...options,

        channel:
            normalizeChannel(
                options.channel
            ),

        playbackMode:
            options.playbackMode
            === "single"
                ? "single"
                : "rotate",

        selectionMode:
            options.selectionMode
            === "top"
                ? "top"
                : "random",

        volume:
            clamp(
                Number(
                    options.volume
                ) || 0,
                0,
                100
            ),

        maxLength:
            clamp(
                Number(
                    options.maxLength
                ) || 60,
                5,
                60
            ),

        filterLongVideos:
            options.filterLongVideos
            === true,

        showInfo:
            options.showInfo
            === true,

        showTimer:
            options.showTimer
            === true,

        recentClipsDays:
            Math.max(
                0,
                Number(
                    options.recentClipsDays
                ) || 0
            ),
    };

    const pool =
        await fetchClipPool(
            api,
            normalized.channel,
            normalized.recentClipsDays
        );

    if (
        generation
        !== state.generation
    ) {
        return null;
    }

    const eligible =
        getEligibleClips(
            pool.clips,
            normalized
        );

    if (!eligible.length) {
        logWarn(
            `random clips: no eligible `
            + `clips found for `
            + `${pool.channel_display_name}`
        );

        websocket.send(
            "notify_random_clips",
            {
                action: "disable",
                reason: "no_clips",
            }
        );

        return null;
    }

    state.active = true;
    state.options = normalized;
    state.clips = eligible;
    state.recentIds = [];

    state.channelName =
        pool.channel;

    state.channelDisplayName =
        pool.channel_display_name;

    const firstClip =
        selectClip();

    if (!firstClip) {
        return null;
    }

    rememberClip(
        firstClip.id
    );

    const seconds =
        sendClip(
            websocket,
            firstClip,
            normalized
        );

    clearTimer();

    state.timer = setTimeout(
        () => {
            if (
                !state.active
                || generation
                    !== state.generation
                || !state.options
            ) {
                return;
            }

            if (
                state.options.playbackMode
                === "single"
            ) {
                state.active = false;
                state.timer = null;

                websocket.send(
                    "notify_random_clips",
                    {
                        action: "disable",
                        reason: "finished",
                    }
                );

                return;
            }

            void playNext(
                websocket,
                generation
            );
        },
        Math.ceil(
            seconds * 1000
        )
    );

    state.timer.unref?.();

    return firstClip;
}

export function disableRandomClips(
    websocket: any,
    notify = true,
) {
    state.generation += 1;
    state.active = false;

    clearTimer();

    state.options = null;
    state.clips = [];
    state.recentIds = [];
    state.channelName = "";
    state.channelDisplayName = "";

    if (notify) {
        websocket.send(
            "notify_random_clips",
            {
                action: "disable",
            }
        );
    }
}
