import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {getTwitchClient} from "../../App";
import {getPrimaryChannel} from "../ConfigHelper";
import {logRegular, logWarn} from "../LogHelper";
import fillTemplate from "../TemplateHelper";
import {sleep} from "../../../../helper/GeneralHelper";

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

        const templateData = {...data, variables};
        const text = (value: unknown) => fillTemplate(String(value ?? ""), templateData).trim();
        const number = (value: unknown, fallback?: number) => {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : fallback;
        };
        const resolveUser = async (value: unknown) => {
            const userName = text(value).replace(/^@/, "");
            if (!userName) return null;
            return await api.users.getUserByName(userName);
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

                case "random_clip": {
                    const channel = text(data.channel)
                        || String(primaryChannel.name ?? primaryChannel.displayName ?? primaryChannel.login ?? "");

                    if (!channel) {
                        logWarn("twitch random_clip requires a channel");
                        return;
                    }

                    const params = new URLSearchParams({
                        mode: data.mode === "top" ? "top" : "random",
                        info: String(data.info === true),
                        volume: String(Math.min(100, Math.max(0, number(data.volume, 50) ?? 50))),
                        max_length: String(Math.min(60, Math.max(5, number(data.max_length, 60) ?? 60))),
                        filter_long_videos: String(data.filter_long_videos === true),
                        show_timer: String(data.show_timer === true),
                        recent_clips: String(Math.max(0, number(data.recent_clips, 0) ?? 0)),
                        channel,
                    });

                    const url = `https://streamgood.gg/clips/player?${params.toString()}`;
                    const playbackSeconds = Math.min(
                        300,
                        Math.max(5, number(data.playback_seconds, data.max_length ?? 60) ?? 60),
                    );

                    this.websocket.send("notify_shoutout_clip", {
                        channel,
                        name: channel,
                        url,
                        playback_seconds: playbackSeconds,
                    });

                    storeResult({
                        url,
                        channel,
                        playback_seconds: playbackSeconds,
                    });
                    break;
                }

                case "clip": {
                    const clipId = await api.clips.createClip({
                        channel: primaryChannel,
                        createAfterDelay: data.create_after_delay === true,
                    });

                    const waitSeconds = number(data.wait_seconds, 35) ?? 35;
                    if (waitSeconds > 0) {
                        await sleep(waitSeconds * 1000);
                    }

                    const clip = await api.clips.getClipById(clipId);
                    storeResult(clip ?? {id: clipId});
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