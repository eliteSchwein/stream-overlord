import {getTwitchUserInfo} from "./TwitchUserInfoHelper";
import {rememberTwitchSubscriptionMonthsFromBadgeInfo} from "./TwitchSubscriptionDurationHelper";
import {hasModerator, hasVip} from "../clients/twitch/helper/PermissionHelper";

export type TwitchAccessRequirements = {
    require_follower: boolean;
    minimum_follow_seconds: number;
    require_subscriber: boolean;
    minimum_sub_tier: number;
    minimum_sub_months: number;
    require_vip: boolean;
    require_moderator: boolean;
};

export type TwitchAccessResult = {
    allowed: boolean;
    code?: string;
    data?: Record<string, any>;
};

function bool(value: any): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    const normalized = String(value ?? "").trim().toLowerCase();
    return ["true", "1", "yes", "on", "enabled", "enable"].includes(normalized);
}

function number(value: any, fallback = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeTier(value: any): number {
    const raw = String(value ?? "").trim().toLowerCase().replace(/\s+/g, "");
    if (!raw || raw === "0" || raw === "none" || raw === "off") return 0;
    if (["1", "tier1", "t1", "1000"].includes(raw)) return 1000;
    if (["2", "tier2", "t2", "2000"].includes(raw)) return 2000;
    if (["3", "tier3", "t3", "3000"].includes(raw)) return 3000;
    const parsed = Number(raw);
    return [1000, 2000, 3000].includes(parsed) ? parsed : 0;
}

export function normalizeTwitchAccessRequirements(source: any = {}): TwitchAccessRequirements {
    return {
        require_follower: bool(
            source.require_follower
            ?? source.requiresFollower
            ?? source.requireFollower,
        ),
        minimum_follow_seconds: Math.max(0, Math.floor(number(
            source.minimum_follow_seconds
            ?? source.minimumFollowSeconds
            ?? source.required_follow_time
            ?? source.requiredFollowTime,
            0,
        ))),
        require_subscriber: bool(
            source.require_subscriber
            ?? source.requiresSubscriber
            ?? source.requireSubscriber,
        ),
        minimum_sub_tier: normalizeTier(
            source.minimum_sub_tier
            ?? source.minimumSubTier
            ?? source.required_sub_plan
            ?? source.requiredSubPlan,
        ),
        minimum_sub_months: Math.max(0, Math.floor(number(
            source.minimum_sub_months
            ?? source.minimumSubMonths
            ?? source.required_sub_time
            ?? source.requiredSubTime,
            0,
        ))),
        require_vip: bool(
            source.require_vip
            ?? source.requiresVip
            ?? source.requireVip,
        ),
        require_moderator: bool(
            source.require_moderator
            ?? source.requiresMod
            ?? source.requiresModerator
            ?? source.requireModerator,
        ),
    };
}

export async function checkTwitchAccessRequirements(options: {
    userId: string;
    userName?: string;
    channelName: string;
    broadcasterId: string;
    badgeInfo?: Map<string, string> | null;
    requirements: any;
}): Promise<TwitchAccessResult> {
    const requirements = normalizeTwitchAccessRequirements(options.requirements);

    if (String(options.userId) === String(options.broadcasterId)) {
        return {allowed: true};
    }

    if (
        requirements.require_moderator
        && !hasModerator(options.channelName, options.userId)
    ) {
        return {allowed: false, code: "moderator_required"};
    }

    if (
        requirements.require_vip
        && !hasVip(options.channelName, options.userId)
    ) {
        return {allowed: false, code: "vip_required"};
    }

    if (options.badgeInfo) {
        await rememberTwitchSubscriptionMonthsFromBadgeInfo(
            options.userId,
            options.badgeInfo,
        );
    }

    const needsFollow =
        requirements.require_follower
        || requirements.minimum_follow_seconds > 0;
    const needsSub =
        requirements.require_subscriber
        || requirements.minimum_sub_tier > 0
        || requirements.minimum_sub_months > 0;

    if (!needsFollow && !needsSub) {
        return {allowed: true};
    }

    const info = await getTwitchUserInfo(
        options.userName || options.userId,
    );

    if (!info) {
        return {allowed: false, code: "user_not_found"};
    }

    if (needsFollow) {
        if (!info.follow?.followed_at) {
            return {allowed: false, code: "follow_required"};
        }

        if (requirements.minimum_follow_seconds > 0) {
            const followedSeconds = Math.max(
                0,
                Math.floor(
                    (Date.now() - new Date(info.follow.followed_at).getTime())
                    / 1000,
                ),
            );

            if (followedSeconds < requirements.minimum_follow_seconds) {
                return {
                    allowed: false,
                    code: "follow_too_short",
                    data: {
                        required_seconds: requirements.minimum_follow_seconds,
                        current_seconds: followedSeconds,
                    },
                };
            }
        }
    }

    if (needsSub) {
        if (!info.subscription) {
            return {allowed: false, code: "subscriber_required"};
        }

        if (requirements.minimum_sub_tier > 0) {
            const tier = Number(info.subscription.tier ?? 0);

            if (!Number.isFinite(tier) || tier < requirements.minimum_sub_tier) {
                return {
                    allowed: false,
                    code: "sub_tier_required",
                    data: {
                        required_tier: requirements.minimum_sub_tier,
                        current_tier: Number.isFinite(tier) ? tier : 0,
                    },
                };
            }
        }

        if (requirements.minimum_sub_months > 0) {
            const months = Number(info.subscription.months ?? 0);

            if (!Number.isFinite(months) || months <= 0) {
                return {
                    allowed: false,
                    code: "sub_time_unknown",
                    data: {
                        required_months: requirements.minimum_sub_months,
                    },
                };
            }

            if (months < requirements.minimum_sub_months) {
                return {
                    allowed: false,
                    code: "sub_time_required",
                    data: {
                        required_months: requirements.minimum_sub_months,
                        current_months: months,
                    },
                };
            }
        }
    }

    return {allowed: true};
}

export function formatAccessDuration(seconds: number): string {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    if (value % 86400 === 0 && value >= 86400) return `${value / 86400}d`;
    if (value % 3600 === 0 && value >= 3600) return `${value / 3600}h`;
    if (value % 60 === 0 && value >= 60) return `${value / 60}m`;
    return `${value}s`;
}

export function formatSubTier(tier: number): string {
    if (tier >= 3000) return "Tier 3";
    if (tier >= 2000) return "Tier 2";
    return "Tier 1";
}
