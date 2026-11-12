// Pure helpers shared by CloudClient (main thread) and CloudWorker.
// Must not import anything from the main application.

export function firstString(...values: any[]) {
    for (const value of values) {
        if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
}

export function trimTrailingSlash(value: string) {
    return value.replace(/\/+$/, "");
}

export function env(name: string) {
    return String(process.env[name] ?? "").trim();
}

export function unwrap(data: any) {
    return data?.data ?? data ?? {};
}

export function normalizeCloudApiMethod(section: string, action: string, explicitMethod: string = "") {
    const aliases: Record<string, string> = {
        // Music
        "music.play": "music_play",
        "music.pause": "music_pause",
        "music.toggle": "music_toggle_pause",
        "music.toggle_pause": "music_toggle_pause",
        "music.next": "music_next",
        "music.prev": "music_back",
        "music.previous": "music_back",
        "music.back": "music_back",
        "music.volume": "music_volume",
        "music.volume_relative": "music_volume_relative",
        "music.shuffle": "music_shuffle",
        "music.loop": "music_loop",
        "music.songrequest_toggle": "music_songrequest_toggle",
        "music.play_song": "music_play_song",
        "music.status": "music_status",
        "music.song_requests.list": "music_song_requests",
        "music.song_requests.remove": "music_song_request_remove",
        "music.song_request.remove": "music_song_request_remove",

        // Giveaway
        "giveaway.start": "start_giveaway",
        "giveaway.stop": "stop_giveaway",
        "giveaway.remove_user": "remove_giveaway_user",

        // Interactions
        "interaction.remove": "remove_interaction",
        "interactions.remove": "remove_interaction",
        "interaction.trigger": "trigger_interaction",
        "interactions.trigger": "trigger_interaction",

        // Auto macros / macros
        "auto_macro.toggle": "toggle_auto_macro",
        "auto_macros.toggle": "toggle_auto_macro",
        "macro.run": "trigger_macro",
        "macros.run": "trigger_macro",

        // Channel points
        "channel_point.toggle": "toggle_channel_point",
        "channel_points.toggle": "toggle_channel_point",

        // Rotating scenes
        "rotating_scene.start": "rotating_scene_start",
        "rotating_scene.stop": "rotating_scene_stop",
        "rotating_scene.status": "rotating_scene_status",
        "rotating_scene.runtime": "rotating_scene_runtime",

        // Audio
        "audio.volume": "set_audio_output_volume",
        "audio.output_volume": "set_audio_output_volume",
        "audio.mute": "set_audio_output_mute",
        "audio.output_mute": "set_audio_output_mute",
        "audio.preset": "audio_preset_apply",
        "audio.apply_preset": "audio_preset_apply",

        // OBS
        "obs.scene": "obs_set_scene",
        "obs.command": "obs_trigger_command",
        "obs.reload_browsers": "obs_reload_browsers",

        // Yolobox
        "yolobox.toggle": "yolobox_toggle",
        "yolobox.execute": "execute_yolobox",

        // Twitch moderation
        "twitch.timeout": "twitch_timeout",
        "twitch.ban": "twitch_ban",
        "twitch.unban": "twitch_unban",
        "twitch.warn": "twitch_warn",
        "twitch.clear_chat": "twitch_clear_chat",
        "twitch.delete_message": "twitch_delete_message",
        "twitch.moderator": "twitch_moderator",
        "twitch.vip": "twitch_vip",
        "twitch.shield_mode": "twitch_shield_mode",
        "twitch.slow_chat": "twitch_slow_chat",
        "twitch.emote_only": "twitch_emote_only",
        "twitch.followers_only": "twitch_followers_only",
        "twitch.subscribers_only": "twitch_subscribers_only",
        "twitch.unique_chat": "twitch_unique_chat",
        "twitch.user_info": "twitch_user_info",

        "twitch.moderation.timeout": "twitch_timeout",
        "twitch.moderation.ban": "twitch_ban",
        "twitch.moderation.unban": "twitch_unban",
        "twitch.moderation.warn": "twitch_warn",
        "twitch.moderation.clear_chat": "twitch_clear_chat",
        "twitch.moderation.delete_message": "twitch_delete_message",
        "twitch.moderation.moderator": "twitch_moderator",
        "twitch.moderation.vip": "twitch_vip",
        "twitch.moderation.shield_mode": "twitch_shield_mode",

        "twitch.chat.slow": "twitch_slow_chat",
        "twitch.chat.slow_chat": "twitch_slow_chat",
        "twitch.chat.emote_only": "twitch_emote_only",
        "twitch.chat.followers_only": "twitch_followers_only",
        "twitch.chat.subscribers_only": "twitch_subscribers_only",
        "twitch.chat.unique": "twitch_unique_chat",
        "twitch.chat.unique_chat": "twitch_unique_chat",

        // Compatibility aliases
        music_prev: "music_back",
        music_previous: "music_back",
    };

    const directMethod = String(explicitMethod ?? "").trim().toLowerCase();
    if (directMethod) return aliases[directMethod] ?? directMethod;

    const cleanSection = String(section ?? "").trim().toLowerCase();
    const cleanAction = String(action ?? "").trim().toLowerCase();
    if (!cleanAction) return "";

    // Cloud may send a qualified action such as `macro.run` directly.
    if (aliases[cleanAction]) return aliases[cleanAction];

    const methods: Record<string, Record<string, string>> = {
        music: {
            play: "music_play",
            pause: "music_pause",
            toggle: "music_toggle_pause",
            toggle_pause: "music_toggle_pause",
            next: "music_next",
            previous: "music_back",
            back: "music_back",
            volume: "music_volume",
            shuffle: "music_shuffle",
            loop: "music_loop",
            songrequest_toggle: "music_songrequest_toggle",
            song_requests_toggle: "music_songrequest_toggle",
            play_song: "music_play_song",
            song_requests: "music_song_requests",
            song_request_remove: "music_song_request_remove",
            remove_song_request: "music_song_request_remove",
        },
        giveaway: {
            start: "start_giveaway",
            stop: "stop_giveaway",
            remove_user: "remove_giveaway_user",
        },
        interactions: {
            remove: "remove_interaction",
            trigger: "trigger_interaction",
        },
        interaction: {
            remove: "remove_interaction",
            trigger: "trigger_interaction",
        },
        auto_macros: {toggle: "toggle_auto_macro"},
        auto_macro: {toggle: "toggle_auto_macro"},
        macros: {run: "trigger_macro"},
        macro: {run: "trigger_macro"},
        channel_points: {toggle: "toggle_channel_point"},
        channel_point: {toggle: "toggle_channel_point"},
        rotating_scene: {start: "rotating_scene_start", stop: "rotating_scene_stop"},
        rotating_scenes: {start: "rotating_scene_start", stop: "rotating_scene_stop"},
        audio: {
            volume: "set_audio_output_volume",
            output_volume: "set_audio_output_volume",
            mute: "set_audio_output_mute",
            output_mute: "set_audio_output_mute",
            preset: "audio_preset_apply",
            apply_preset: "audio_preset_apply",
        },
        obs: {scene: "obs_set_scene", command: "obs_trigger_command", reload_browsers: "obs_reload_browsers"},
        yolobox: {toggle: "yolobox_toggle", execute: "execute_yolobox"},

        twitch: {
            timeout: "twitch_timeout",
            ban: "twitch_ban",
            unban: "twitch_unban",
            warn: "twitch_warn",
            clear_chat: "twitch_clear_chat",
            delete_message: "twitch_delete_message",
            moderator: "twitch_moderator",
            vip: "twitch_vip",
            shield_mode: "twitch_shield_mode",
            slow: "twitch_slow_chat",
            slow_chat: "twitch_slow_chat",
            emote_only: "twitch_emote_only",
            followers_only: "twitch_followers_only",
            subscribers_only: "twitch_subscribers_only",
            unique: "twitch_unique_chat",
            unique_chat: "twitch_unique_chat",
            user_info: "twitch_user_info",
        },

        twitch_moderation: {
            timeout: "twitch_timeout",
            ban: "twitch_ban",
            unban: "twitch_unban",
            warn: "twitch_warn",
            clear_chat: "twitch_clear_chat",
            delete_message: "twitch_delete_message",
            moderator: "twitch_moderator",
            vip: "twitch_vip",
            shield_mode: "twitch_shield_mode",
        },

        twitch_chat: {
            slow: "twitch_slow_chat",
            slow_chat: "twitch_slow_chat",
            emote_only: "twitch_emote_only",
            followers_only: "twitch_followers_only",
            subscribers_only: "twitch_subscribers_only",
            unique: "twitch_unique_chat",
            unique_chat: "twitch_unique_chat",
        },
    };

    // If the cloud already sends a real websocket method, use it unchanged.
    if (cleanAction.includes("_") && !methods[cleanSection]?.[cleanAction]) return cleanAction;
    return methods[cleanSection]?.[cleanAction] ?? cleanAction;
}

export function normalizeCloudApiParams(method: string, payload: any) {
    const params = payload && typeof payload === "object" && !Array.isArray(payload)
        ? {...payload}
        : {};

    if (method === "trigger_macro" && !params.macro) {
        params.macro = firstString(params.id, params.name);
    }
    if (method === "toggle_auto_macro" && params.enable === undefined && params.enabled !== undefined) {
        params.enable = Boolean(params.enabled);
    }
    if (method === "set_audio_output_mute" && params.muted === undefined && params.enabled !== undefined) {
        params.muted = Boolean(params.enabled);
    }

    if (
        method.startsWith("twitch_")
        && params.user === undefined
    ) {
        params.user = firstString(
            params.login,
            params.user_login,
            params.username,
            params.user_id,
            params.target,
        );
    }

    if (
        method === "twitch_delete_message"
        && params.message_id === undefined
    ) {
        params.message_id = firstString(
            params.messageId,
            params.id,
        );
    }

    if (
        ["twitch_moderator", "twitch_vip"].includes(method)
        && params.action === undefined
        && params.enabled !== undefined
    ) {
        params.action =
            Boolean(params.enabled)
                ? "add"
                : "remove";
    }

    return params;
}

export function isCloudSuppressedUpdate(method: string) {
    return String(method ?? "").toLowerCase().includes("cava");
}

export function stripCloudSuppressedData(value: any): any {
    if (Array.isArray(value)) return value.map(stripCloudSuppressedData);
    if (!value || typeof value !== "object") return value;

    const result: Record<string, any> = {};
    for (const [key, entry] of Object.entries(value)) {
        if (key.toLowerCase().includes("cava")) continue;
        result[key] = stripCloudSuppressedData(entry);
    }
    return result;
}

export function isCloudRecord(value: any): value is Record<string, any> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function cloneCloudValue(value: any): any {
    if (Array.isArray(value)) return value.map(cloneCloudValue);
    if (!isCloudRecord(value)) return value;

    const result: Record<string, any> = {};
    for (const [key, entry] of Object.entries(value)) {
        result[key] = cloneCloudValue(entry);
    }
    return result;
}

/**
 * Build a JSON merge-style delta. Objects are diffed recursively so a notify
 * with one changed field only forwards that field. Arrays are intentionally
 * atomic: if an array changes, the latest complete array is sent. Removed
 * object keys are represented as null so the cloud can remove them while
 * merging the delta into its existing state.
 */
export function createCloudDelta(previous: any, next: any): any | undefined {
    if (Object.is(previous, next)) return undefined;

    if (Array.isArray(previous) || Array.isArray(next)) {
        try {
            if (JSON.stringify(previous) === JSON.stringify(next)) return undefined;
        } catch {}
        return cloneCloudValue(next);
    }

    if (isCloudRecord(previous) && isCloudRecord(next)) {
        const delta: Record<string, any> = {};
        let changed = false;

        for (const key of Object.keys(next)) {
            const childDelta = createCloudDelta(previous[key], next[key]);
            if (childDelta === undefined) continue;
            delta[key] = childDelta;
            changed = true;
        }

        for (const key of Object.keys(previous)) {
            if (Object.prototype.hasOwnProperty.call(next, key)) continue;
            delta[key] = null;
            changed = true;
        }

        return changed ? delta : undefined;
    }

    return cloneCloudValue(next);
}
