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

type RelationRaw = {
    follow: any;
    subscription: any;
    isMod: boolean | null;
    isVip: boolean | null;
};

function toIsoDate(value: any): string | null {
    if (value instanceof Date) return value.toISOString();
    return value ?? null;
}

function daysSince(value: string | null): number | null {
    if (!value) return null;

    const time = new Date(value).getTime();
    if (Number.isNaN(time)) return null;

    return Math.max(0, Math.floor((Date.now() - time) / (24 * 60 * 60 * 1000)));
}

async function getTwitchUserRelationRaw(
    user: any,
    options: {moderation: boolean},
): Promise<RelationRaw> {
    const broadcaster: any = getPrimaryChannel();
    const api = getTwitchClient()?.getBot()?.api;

    if (!broadcaster?.id || !user?.id) {
        return {follow: null, subscription: null, isMod: null, isVip: null};
    }

    // null = unknown (api call failed, e.g. missing scope)
    const settle = async <T>(request: () => Promise<T>, fallback: T | null) => {
        try {
            return await request();
        } catch {
            return fallback;
        }
    };

    const isBroadcaster = String(user.id) === String(broadcaster.id);

    const [follow, subscription, isMod, isVip] = await Promise.all([
        settle(() => broadcaster.getChannelFollower(user), null),
        settle(() => broadcaster.getSubscriber(user), null),
        options.moderation && api && !isBroadcaster
            ? settle(() => api.moderation.checkUserMod(broadcaster, user), null)
            : Promise.resolve(isBroadcaster ? false : null),
        options.moderation && api && !isBroadcaster
            ? settle(() => api.channels.checkVipForUser(broadcaster, user), null)
            : Promise.resolve(isBroadcaster ? false : null),
    ]);

    return {follow, subscription, isMod, isVip};
}

/**
 * Relation of a user to the primary channel, in the camelCase shape used by
 * command user params.
 */
export async function getTwitchUserRelation(user: any) {
    const broadcaster: any = getPrimaryChannel();
    const {follow, subscription, isMod, isVip} = await getTwitchUserRelationRaw(user, {
        moderation: true,
    });

    const followedAt = toIsoDate(follow?.followDate);
    const tier = Number(subscription?.tier);
    const creationDate = toIsoDate(user?.creationDate);

    return {
        isBroadcaster: !!broadcaster?.id && String(user?.id) === String(broadcaster.id),
        isMod,
        isVip,
        isFollowing: !!follow,
        followedAt,
        followDays: daysSince(followedAt),
        isSubscriber: !!subscription,
        subTier: Number.isFinite(tier) && tier > 0 ? Math.round(tier / 1000) : null,
        subMonths: subscription ? getTwitchSubscriptionMonths(user.id) : null,
        subIsGift: subscription ? subscription.isGift === true : false,
        subGifterName: subscription
            ? subscription.gifterDisplayName ?? subscription.gifterName ?? null
            : null,
        accountAgeDays: daysSince(creationDate),
    };
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

    const {follow, subscription} = await getTwitchUserRelationRaw(user, {
        moderation: false,
    });

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

const USER_OBJECT_CACHE_TTL = 30_000;
const userObjectCache = new Map<string, {expires: number, promise: Promise<any | null>}>();

/**
 * Full user object used in macro variables (command user params, ${user},
 * ${gifter} and the twitch user_info task).
 */
export async function buildTwitchUserObject(user: any) {
    const api = getTwitchClient()?.getBot()?.api;

    const [gameName, relation] = await Promise.all([
        api
            ? api.streams.getStreamByUserId(user.id)
                .then((stream: any) => stream?.gameName ?? "")
                .catch(() => {
                    logWarn(`failed to fetch category for twitch user ${user.displayName}`);
                    return "";
                })
            : Promise.resolve(""),
        getTwitchUserRelation(user),
    ]);

    return {
        id: user.id,
        name: user.name,
        displayName: user.displayName,
        description: user.description,
        profilePictureUrl: user.profilePictureUrl,
        broadcasterType: user.broadcasterType,
        creationDate: toIsoDate(user.creationDate),
        gameName,
        ...relation,
    };
}

/**
 * Looks up a user by id or login and builds the full user object. Results are
 * cached briefly so several macros for the same event share the api calls.
 */
export function getTwitchUserObject(loginOrId: string): Promise<any | null> {
    const query = String(loginOrId ?? "").trim().replace(/^@/, "");

    if (!query) return Promise.resolve(null);

    const key = query.toLowerCase();
    const now = Date.now();
    const cached = userObjectCache.get(key);

    if (cached && cached.expires > now) return cached.promise;

    if (userObjectCache.size > 500) {
        for (const [cacheKey, entry] of userObjectCache) {
            if (entry.expires <= now) userObjectCache.delete(cacheKey);
        }
    }

    const promise = (async () => {
        const api = getTwitchClient()?.getBot()?.api;

        if (!api) throw new Error("twitch api is not ready");

        let user: any = null;

        if (/^\d+$/.test(query)) {
            user = await api.users.getUserById(query);
        }

        if (!user) {
            user = await api.users.getUserByName(query);
        }

        return user ? await buildTwitchUserObject(user) : null;
    })();

    userObjectCache.set(key, {expires: now + USER_OBJECT_CACHE_TTL, promise});
    promise.catch(() => userObjectCache.delete(key));

    return promise;
}

/**
 * Example user object for the template variable editor.
 */
export function getExampleTwitchUserObject(overrides: Record<string, any> = {}) {
    return {
        id: "987654321",
        name: "testuser",
        displayName: "TestUser",
        description: "",
        profilePictureUrl: "",
        broadcasterType: "",
        creationDate: "2020-01-01T00:00:00.000Z",
        gameName: "",
        isBroadcaster: false,
        isMod: false,
        isVip: false,
        isFollowing: true,
        followedAt: "2023-01-01T00:00:00.000Z",
        followDays: 365,
        isSubscriber: true,
        subTier: 1,
        subMonths: 6,
        subIsGift: false,
        subGifterName: null,
        accountAgeDays: 1000,
        ...overrides,
    };
}
