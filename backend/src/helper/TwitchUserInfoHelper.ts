import {getTwitchClient} from "../App";
import {getPrimaryChannel} from "./ConfigHelper";
import {logWarn} from "./LogHelper";
import {getTwitchSubscriptionMonths} from "./TwitchSubscriptionDurationHelper";

export interface TwitchUserInfoResult {
    id: string;
    login: string;
    display_name: string;
    description: string;
    broadcaster_type: string;
    profile_image_url: string;
    offline_image_url: string;
    created_at: string | null;
    follow: {
        followed_at: string | null;
    } | null;
    subscription: {
        tier: string;
        is_gift: boolean;
        gifter_id: string | null;
        gifter_name: string | null;
        months: number | null;
    } | null;
}

export async function getTwitchUserInfo(
    loginOrId: string,
): Promise<TwitchUserInfoResult | null> {
    const bot = getTwitchClient()?.getBot();

    if (!bot?.api) {
        throw new Error("twitch api is not ready");
    }

    const query = String(loginOrId ?? "")
        .trim()
        .replace(/^@/, "");

    if (!query) {
        throw new Error("missing user");
    }

    let user: any = null;

    try {
        if (/^\d+$/.test(query)) {
            user = await bot.api.users.getUserById(query);
        }

        if (!user) {
            user = await bot.api.users.getUserByName(query);
        }
    } catch (error) {
        logWarn(`twitch user info lookup failed for ${query}`);
        throw error;
    }

    if (!user) {
        return null;
    }

    const broadcaster: any = getPrimaryChannel();

    let follow: any = null;
    let subscription: any = null;

    if (broadcaster?.id) {
        try {
            follow = await broadcaster.getChannelFollower(user);
        } catch {
            follow = null;
        }

        try {
            subscription = await broadcaster.getSubscriber(user);
        } catch {
            subscription = null;
        }
    }

    return {
        id: user.id,
        login: user.name,
        display_name: user.displayName,
        description: user.description,
        broadcaster_type: user.broadcasterType,
        profile_image_url: user.profilePictureUrl,
        offline_image_url: user.offlinePlaceholderUrl,
        created_at:
            user.creationDate instanceof Date
                ? user.creationDate.toISOString()
                : user.creationDate ?? null,

        follow: follow
            ? {
                followed_at:
                    follow.followDate instanceof Date
                        ? follow.followDate.toISOString()
                        : follow.followDate ?? null,
            }
            : null,

        subscription: subscription
            ? {
                tier: String(subscription.tier ?? ""),
                is_gift: subscription.isGift === true,
                gifter_id: subscription.gifterId ?? null,
                gifter_name:
                    subscription.gifterDisplayName
                    ?? subscription.gifterName
                    ?? null,
                months:
                    getTwitchSubscriptionMonths(user.id),
            }
            : null,
    };
}
