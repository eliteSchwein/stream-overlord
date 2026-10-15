import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {getTwitchClient} from "../../App";
import {getPrimaryChannel} from "../ConfigHelper";
import {logRegular, logWarn} from "../LogHelper";
import fillTemplate from "../TemplateHelper";
import {sleep} from "../../../../helper/GeneralHelper";
import {disableRandomClips, enableRandomClips} from "../RandomClipsHelper";

export default class TwitchMacroTask extends BaseMacroTask {
    channel = "twitch";

    async handle(method: string, data: any = {}, variables: any = {}) {
        logRegular(`trigger twitch: ${method}`);

        const bot = getTwitchClient()?.getBot();
        const api = bot?.api as any;
        const primaryChannel = getPrimaryChannel();

        if (!bot || !api || !primaryChannel?.id) {
            logWarn("twitch macro skipped: twitch is not connected");
            return;
        }

        const templateData = {...data, ...variables, variables};
        const text = (value: unknown) => fillTemplate(String(value ?? ""), templateData).trim();
        const number = (value: unknown, fallback?: number) => {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : fallback;
        };
        const resolveTemplateValue = (value: unknown): unknown => {
            if (typeof value !== "string") return value;

            const match = value.trim().match(/^\$\{([^}]+)}$/);
            if (!match) return value;

            const parts = match[1].split(".").map(part => part.trim()).filter(Boolean);
            let resolved: any = templateData;

            for (const part of parts) {
                if (resolved === null || resolved === undefined || typeof resolved !== "object") {
                    return value;
                }

                resolved = resolved[part];
            }

            return resolved ?? value;
        };

        const resolveUser = async (value: unknown) => {
            const resolvedValue = resolveTemplateValue(value);

            if (
                resolvedValue === null ||
                resolvedValue === undefined ||
                resolvedValue === ""
            ) {
                return null;
            }

            const hydrateUser = async (user: any) => {
                const hasRequiredFields =
                    user?.id &&
                    user?.name &&
                    user?.displayName &&
                    user?.profilePictureUrl &&
                    user?.gameName !== undefined;

                if (hasRequiredFields) {
                    return user;
                }

                let fetchedUser: any = null;

                if (user?.id) {
                    fetchedUser = await api.users.getUserById(String(user.id));
                } else if (user?.name) {
                    const userName = String(user.name).trim().replace(/^@/, "");

                    if (userName) {
                        fetchedUser = await api.users.getUserByName(userName);
                    }
                }

                if (!fetchedUser) {
                    return null;
                }

                let gameName = user?.gameName ?? "";

                if (user?.gameName === undefined) {
                    try {
                        const stream = await api.streams.getStreamByUserId(fetchedUser.id);
                        gameName = stream?.gameName ?? "";
                    } catch {
                        logWarn(`failed to fetch category for twitch user ${fetchedUser.displayName}`);
                    }
                }

                return {
                    ...user,
                    id: fetchedUser.id,
                    name: fetchedUser.name,
                    displayName: fetchedUser.displayName,
                    description: fetchedUser.description,
                    profilePictureUrl: fetchedUser.profilePictureUrl,
                    broadcasterType: fetchedUser.broadcasterType,
                    creationDate: fetchedUser.creationDate,
                    gameName,
                };
            };

            if (typeof resolvedValue === "object") {
                return hydrateUser(resolvedValue);
            }

            const input = String(resolvedValue).trim().replace(/^@/, "");

            if (!input) {
                return null;
            }

            let fetchedUser: any = null;

            if (/^\d+$/.test(input)) {
                fetchedUser = await api.users.getUserById(input);
            } else {
                fetchedUser = await api.users.getUserByName(input);
            }

            if (!fetchedUser) {
                return null;
            }

            let gameName = "";

            try {
                const stream = await api.streams.getStreamByUserId(fetchedUser.id);
                gameName = stream?.gameName ?? "";
            } catch {
                logWarn(`failed to fetch category for twitch user ${fetchedUser.displayName}`);
            }

            return {
                id: fetchedUser.id,
                name: fetchedUser.name,
                displayName: fetchedUser.displayName,
                description: fetchedUser.description,
                profilePictureUrl: fetchedUser.profilePictureUrl,
                broadcasterType: fetchedUser.broadcasterType,
                creationDate: fetchedUser.creationDate,
                gameName,
            };
        };

        const sanitizeResult = (value: any): any => {
            if (value === null || value === undefined) return value;

            if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
                return value;
            }

            if (Array.isArray(value)) {
                return value.map(sanitizeResult);
            }

            if (value instanceof Date) {
                return value.toISOString();
            }

            if (typeof value === "object") {
                const result: Record<string, any> = {};

                for (const [key, entry] of Object.entries(value)) {
                    if (typeof entry === "function" || entry === undefined) continue;

                    try {
                        result[key] = sanitizeResult(entry);
                    } catch {
                        // Skip values that cannot be safely serialized.
                    }
                }

                return result;
            }

            return String(value);
        };

        const storeResult = (value: any) => {
            const variablePath = text(data.variable ?? data.result_variable);
            if (!variablePath) return;

            const parts = variablePath.split(".").map(part => part.trim()).filter(Boolean);
            if (!parts.length) return;

            let target = variables;
            for (let index = 0; index < parts.length - 1; index++) {
                const key = parts[index];
                if (!target[key] || typeof target[key] !== "object" || Array.isArray(target[key])) {
                    target[key] = {};
                }
                target = target[key];
            }

            target[parts[parts.length - 1]] = sanitizeResult(value);
        };

        try {
            switch (method) {

                case "enable_random_clip": {
                    const channel = text(data.channel)
                        || String(
                            primaryChannel.name
                            ?? primaryChannel.displayName
                            ?? primaryChannel.login
                            ?? ""
                        );

                    if (!channel) {
                        logWarn("twitch enable_random_clip requires a channel");
                        return;
                    }

                    const result = await enableRandomClips(
                        api,
                        this.websocket,
                        {
                            channel,

                            // New option. Defaults to rotate for backwards
                            // compatibility with the old enable_random_clip task.
                            playbackMode:
                                data.playback_mode === "single"
                                    ? "single"
                                    : "rotate",

                            // Keep the existing `mode` field as clip selection.
                            selectionMode:
                                data.mode === "top"
                                    ? "top"
                                    : "random",

                            volume:
                                Math.min(
                                    100,
                                    Math.max(
                                        0,
                                        number(data.volume, 50) ?? 50
                                    )
                                ),

                            maxLength:
                                Math.min(
                                    60,
                                    Math.max(
                                        5,
                                        number(data.max_length, 60) ?? 60
                                    )
                                ),

                            filterLongVideos:
                                data.filter_long_videos === true,

                            showInfo:
                                data.info === true,

                            showTimer:
                                data.show_timer === true,

                            // 0 = all time, otherwise number of days.
                            recentClipsDays:
                                Math.max(
                                    0,
                                    number(data.recent_clips, 0) ?? 0
                                ),
                        }
                    );

                    if (result) {
                        storeResult({
                            ...result,
                            channel,
                            playback_mode:
                                data.playback_mode === "single"
                                    ? "single"
                                    : "rotate",
                            selection:
                                data.mode === "top"
                                    ? "top"
                                    : "random",
                        });
                    }

                    break;
                }

                case "disable_random_clip": {
                    disableRandomClips(this.websocket);
                    break;
                }

                case "clip": {
                    const clipId = await api.clips.createClip({
                        channel: primaryChannel,
                        createAfterDelay: data.create_after_delay === true,
                    });

                    // Twitch clip creation is asynchronous. The ID returned by
                    // createClip only means the request was accepted; the clip is
                    // not valid until Get Clips can actually resolve that ID.
                    const waitSeconds = Math.max(0, number(data.wait_seconds, 60) ?? 60);
                    const pollIntervalMs = Math.max(
                        500,
                        Math.min(5000, (number(data.poll_interval_ms, 2000) ?? 2000)),
                    );
                    const deadline = Date.now() + (waitSeconds * 1000);

                    let clip: any = null;
                    let lastLookupError: unknown = null;

                    do {
                        try {
                            clip = await api.clips.getClipById(clipId);
                            lastLookupError = null;
                        } catch (error) {
                            lastLookupError = error;
                        }

                        if (clip || Date.now() >= deadline) {
                            break;
                        }

                        await sleep(Math.min(pollIntervalMs, Math.max(1, deadline - Date.now())));
                    } while (Date.now() < deadline);

                    if (!clip) {
                        logWarn(
                            `twitch clip creation failed: clip ${clipId} was not published after ${waitSeconds}s`,
                        );

                        if (lastLookupError) {
                            logWarn(JSON.stringify(lastLookupError, Object.getOwnPropertyNames(lastLookupError)));
                        }

                        // Keep url empty on failure. This is important for macros
                        // that branch on ${clip_url} / result.url.
                        storeResult({
                            id: clipId,
                            url: "",
                            success: false,
                        });
                        break;
                    }

                    storeResult({
                        id: clip.id,
                        url: clip.url,
                        success: true,
                        embed_url: clip.embedUrl,
                        title: clip.title,
                        broadcaster_id: clip.broadcasterId,
                        broadcaster_name: clip.broadcasterDisplayName,
                        creator_id: clip.creatorId,
                        creator_name: clip.creatorDisplayName,
                        game_id: clip.gameId,
                        language: clip.language,
                        thumbnail_url: clip.thumbnailUrl,
                        duration: clip.duration,
                        views: clip.views,
                        video_id: clip.videoId,
                        vod_offset: clip.vodOffset,
                        created_at: clip.creationDate,
                        is_featured: clip.isFeatured,
                    });

                    break;
                }

                case "shoutout": {
                    const user = await resolveUser(data.user);
                    if (!user) {
                        logWarn("twitch shoutout requires a valid user");
                        return;
                    }
                    await api.chat.shoutoutUser(primaryChannel.id, user.id);
                    break;
                }

                case "set_category": {
                    const categoryName = text(data.category);
                    if (!categoryName) {
                        logWarn("twitch set_category requires category");
                        return;
                    }
                    const category = await api.games.getGameByName(categoryName);
                    if (!category) {
                        logWarn(`twitch category not found: ${categoryName}`);
                        return;
                    }
                    await api.channels.updateChannelInfo(primaryChannel.id, {gameId: category.id});
                    break;
                }

                case "poll": {
                    const action = data.action ?? "create";
                    if (action === "create") {
                        const choices = Array.isArray(data.choices)
                            ? data.choices.map(text).filter(Boolean)
                            : String(data.choices ?? "").split("\n").map(text).filter(Boolean);

                        if (!text(data.title) || choices.length < 2) {
                            logWarn("twitch poll create requires a title and at least two choices");
                            return;
                        }

                        const poll = await api.polls.createPoll(primaryChannel.id, {
                            title: text(data.title),
                            choices,
                            duration: number(data.duration, 60),
                            channelPointsPerVote: data.channel_points_voting
                                ? number(data.points_per_vote, 1)
                                : undefined,
                        });

                        storeResult(poll);
                        return;
                    }

                    if (!data.poll_id) {
                        logWarn("twitch poll end requires poll_id");
                        return;
                    }

                    await api.polls.endPoll(
                        primaryChannel.id,
                        text(data.poll_id),
                        action === "terminate" ? "TERMINATED" : "ARCHIVED",
                    );
                    break;
                }

                case "prediction": {
                    const action = data.action ?? "create";
                    if (action === "create") {
                        const outcomes = Array.isArray(data.outcomes)
                            ? data.outcomes.map(text).filter(Boolean)
                            : String(data.outcomes ?? "").split("\n").map(text).filter(Boolean);

                        if (!text(data.title) || outcomes.length < 2) {
                            logWarn("twitch prediction create requires a title and at least two outcomes");
                            return;
                        }

                        const prediction = await api.predictions.createPrediction(primaryChannel.id, {
                            title: text(data.title),
                            outcomes,
                            autoLockAfter: number(data.duration, 120),
                        });

                        storeResult(prediction);
                        return;
                    }

                    if (!data.prediction_id) {
                        logWarn(`twitch prediction ${action} requires prediction_id`);
                        return;
                    }

                    if (action === "lock") {
                        await api.predictions.lockPrediction(primaryChannel.id, text(data.prediction_id));
                    } else if (action === "cancel") {
                        await api.predictions.cancelPrediction(primaryChannel.id, text(data.prediction_id));
                    } else if (action === "resolve") {
                        if (!data.winning_outcome_id) {
                            logWarn("twitch prediction resolve requires winning_outcome_id");
                            return;
                        }
                        await api.predictions.resolvePrediction(
                            primaryChannel.id,
                            text(data.prediction_id),
                            text(data.winning_outcome_id),
                        );
                    }
                    break;
                }

                case "stream_marker": {
                    await api.streams.createStreamMarker(
                        primaryChannel.id,
                        text(data.description) || undefined,
                    );
                    break;
                }

                case "vip": {
                    const user = await resolveUser(data.user);
                    if (!user) {
                        logWarn("twitch vip requires a valid user");
                        return;
                    }
                    const action = data.action ?? "add";
                    if (action === "remove") {
                        await api.channels.removeVip(primaryChannel.id, user.id);
                    } else {
                        await api.channels.addVip(primaryChannel.id, user.id);
                    }
                    break;
                }

                case "slow_chat":
                case "enable_slow_chat": {
                    const enabled = method === "enable_slow_chat"
                        ? true
                        : data.enabled !== false;

                    if (!enabled) {
                        await api.chat.updateSettings(primaryChannel.id, {
                            slowModeEnabled: false,
                        });
                        break;
                    }

                    const delay = number(data.delay ?? data.duration, 30) ?? 30;
                    if (delay < 3 || delay > 120) {
                        logWarn("twitch slow_chat delay must be between 3 and 120 seconds");
                        return;
                    }

                    await api.chat.updateSettings(primaryChannel.id, {
                        slowModeEnabled: true,
                        slowModeDelay: Math.round(delay),
                    });
                    break;
                }

                case "disable_slow_chat": {
                    await api.chat.updateSettings(primaryChannel.id, {
                        slowModeEnabled: false,
                    });
                    break;
                }

                case "clear_chat": {
                    await api.moderation.deleteChatMessages(primaryChannel.id);
                    break;
                }

                case "emote_only": {
                    await api.chat.updateSettings(primaryChannel.id, {
                        emoteOnlyModeEnabled: data.enabled !== false,
                    });
                    break;
                }

                case "followers_only": {
                    const enabled = data.enabled !== false;
                    const delay = number(data.delay ?? data.duration, 0) ?? 0;

                    if (delay < 0 || delay > 129600) {
                        logWarn("twitch followers_only delay must be between 0 and 129600 minutes");
                        return;
                    }

                    await api.chat.updateSettings(primaryChannel.id, enabled
                        ? {
                            followerOnlyModeEnabled: true,
                            followerOnlyModeDelay: Math.round(delay),
                        }
                        : {followerOnlyModeEnabled: false});
                    break;
                }

                case "subscribers_only": {
                    await api.chat.updateSettings(primaryChannel.id, {
                        subscriberOnlyModeEnabled: data.enabled !== false,
                    });
                    break;
                }

                case "unique_chat": {
                    await api.chat.updateSettings(primaryChannel.id, {
                        uniqueChatModeEnabled: data.enabled !== false,
                    });
                    break;
                }

                case "chat_settings": {
                    const settings: Record<string, any> = {};

                    if (data.slow_mode !== undefined || data.slow !== undefined) {
                        const enabled = Boolean(data.slow_mode ?? data.slow);
                        settings.slowModeEnabled = enabled;

                        if (enabled && (data.slow_delay !== undefined || data.delay !== undefined)) {
                            const delay = number(data.slow_delay ?? data.delay);
                            if (delay === undefined || delay < 3 || delay > 120) {
                                logWarn("twitch chat_settings slow_delay must be between 3 and 120 seconds");
                                return;
                            }
                            settings.slowModeDelay = Math.round(delay);
                        }
                    }

                    if (data.emote_only !== undefined) {
                        settings.emoteOnlyModeEnabled = Boolean(data.emote_only);
                    }

                    if (data.followers_only !== undefined) {
                        const enabled = Boolean(data.followers_only);
                        settings.followerOnlyModeEnabled = enabled;

                        if (enabled && data.followers_delay !== undefined) {
                            const delay = number(data.followers_delay);
                            if (delay === undefined || delay < 0 || delay > 129600) {
                                logWarn("twitch chat_settings followers_delay must be between 0 and 129600 minutes");
                                return;
                            }
                            settings.followerOnlyModeDelay = Math.round(delay);
                        }
                    }

                    if (data.subscribers_only !== undefined) {
                        settings.subscriberOnlyModeEnabled = Boolean(data.subscribers_only);
                    }

                    if (data.unique_chat !== undefined) {
                        settings.uniqueChatModeEnabled = Boolean(data.unique_chat);
                    }

                    if (data.non_moderator_delay !== undefined) {
                        const raw = data.non_moderator_delay;
                        const enabled = raw !== false && raw !== null && raw !== 0 && raw !== "0";
                        settings.nonModeratorChatDelayEnabled = enabled;

                        if (enabled) {
                            const delay = number(raw);
                            if (![2, 4, 6].includes(delay ?? -1)) {
                                logWarn("twitch chat_settings non_moderator_delay must be 2, 4 or 6 seconds, or false to disable");
                                return;
                            }
                            settings.nonModeratorChatDelay = delay;
                        }
                    }

                    if (!Object.keys(settings).length) {
                        logWarn("twitch chat_settings requires at least one setting");
                        return;
                    }

                    const result = await api.chat.updateSettings(primaryChannel.id, settings);
                    storeResult(result);
                    break;
                }

                case "ban": {
                    const user = await resolveUser(data.user);
                    if (!user) {
                        logWarn("twitch ban requires a valid user");
                        return;
                    }

                    await api.moderation.banUser(primaryChannel.id, {
                        user,
                        reason: text(data.reason) || undefined,
                    });
                    break;
                }

                case "timeout": {
                    const user = await resolveUser(data.user);
                    if (!user) {
                        logWarn("twitch timeout requires a valid user");
                        return;
                    }

                    const duration = number(data.duration);
                    if (!duration || duration < 1 || duration > 1_209_600) {
                        logWarn("twitch timeout duration must be between 1 and 1209600 seconds");
                        return;
                    }

                    await api.moderation.banUser(primaryChannel.id, {
                        user,
                        duration,
                        reason: text(data.reason) || undefined,
                    });
                    break;
                }

                case "ad": {
                    const duration = number(data.duration, 30);
                    if (![30, 60, 90, 120, 150, 180].includes(duration!)) {
                        logWarn("twitch ad duration must be 30, 60, 90, 120, 150 or 180 seconds");
                        return;
                    }
                    await api.channels.startChannelCommercial(primaryChannel.id, duration);
                    break;
                }

                default:
                    logWarn(`invalid twitch method: ${method}`);
            }
        } catch (error) {
            logWarn(`twitch macro ${method} failed:`);
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        }
    }
}