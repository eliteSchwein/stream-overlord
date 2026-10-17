import {getTwitchClient} from "../App";
import {getPrimaryChannel} from "./ConfigHelper";

function getContext() {
    const bot = getTwitchClient()?.getBot();
    const api: any = bot?.api;
    const channel: any = getPrimaryChannel();

    if (!bot || !api || !channel?.id) {
        throw new Error("twitch is not connected");
    }

    return {
        bot,
        api,
        channel,
    };
}

export async function resolveTwitchUser(value: unknown) {
    const {api} = getContext();

    if (value && typeof value === "object") {
        const objectValue: any = value;

        if (objectValue.id) {
            return api.users.getUserById(
                String(objectValue.id),
            );
        }

        if (objectValue.name || objectValue.login) {
            return api.users.getUserByName(
                String(
                    objectValue.name
                    ?? objectValue.login,
                )
                    .trim()
                    .replace(/^@/, ""),
            );
        }
    }

    const input =
        String(value ?? "")
            .trim()
            .replace(/^@/, "");

    if (!input) {
        return null;
    }

    if (/^\d+$/.test(input)) {
        return api.users.getUserById(input);
    }

    return api.users.getUserByName(input);
}

async function requireUser(value: unknown) {
    const user = await resolveTwitchUser(value);

    if (!user) {
        throw new Error("twitch user not found");
    }

    return user;
}

export async function timeoutTwitchUser(
    userValue: unknown,
    duration: number,
    reason?: string,
) {
    const {api, channel} = getContext();
    const user = await requireUser(userValue);

    const seconds = Math.floor(Number(duration));

    if (
        !Number.isFinite(seconds)
        || seconds < 1
        || seconds > 1_209_600
    ) {
        throw new Error(
            "timeout duration must be between 1 and 1209600 seconds",
        );
    }

    const result = await api.moderation.banUser(
        channel.id,
        {
            user,
            duration: seconds,
            reason:
                String(reason ?? "").trim()
                || undefined,
        },
    );

    return {
        status: "okay",
        action: "timeout",
        user: {
            id: user.id,
            login: user.name,
            display_name: user.displayName,
        },
        duration: seconds,
        reason:
            String(reason ?? "").trim()
            || null,
        result,
    };
}

export async function banTwitchUser(
    userValue: unknown,
    reason?: string,
) {
    const {api, channel} = getContext();
    const user = await requireUser(userValue);

    const result = await api.moderation.banUser(
        channel.id,
        {
            user,
            reason:
                String(reason ?? "").trim()
                || undefined,
        },
    );

    return {
        status: "okay",
        action: "ban",
        user: {
            id: user.id,
            login: user.name,
            display_name: user.displayName,
        },
        reason:
            String(reason ?? "").trim()
            || null,
        result,
    };
}

export async function unbanTwitchUser(
    userValue: unknown,
) {
    const {api, channel} = getContext();
    const user = await requireUser(userValue);

    await api.moderation.unbanUser(
        channel.id,
        user.id,
    );

    return {
        status: "okay",
        action: "unban",
        user: {
            id: user.id,
            login: user.name,
            display_name: user.displayName,
        },
    };
}

export async function warnTwitchUser(
    userValue: unknown,
    reason: string,
) {
    const {api, channel} = getContext();
    const user = await requireUser(userValue);

    const cleanReason =
        String(reason ?? "").trim();

    if (!cleanReason) {
        throw new Error("warning reason is required");
    }

    if (cleanReason.length > 500) {
        throw new Error(
            "warning reason must not exceed 500 characters",
        );
    }

    const result = await api.moderation.warnUser(
        channel.id,
        user.id,
        cleanReason,
    );

    return {
        status: "okay",
        action: "warn",
        user: {
            id: user.id,
            login: user.name,
            display_name: user.displayName,
        },
        reason: cleanReason,
        result,
    };
}

export async function clearTwitchChat() {
    const {api, channel} = getContext();

    await api.moderation.deleteChatMessages(
        channel.id,
    );

    return {
        status: "okay",
        action: "clear_chat",
    };
}

export async function deleteTwitchMessage(
    messageId: string,
) {
    const {api, channel} = getContext();

    const id =
        String(messageId ?? "").trim();

    if (!id) {
        throw new Error("message_id is required");
    }

    await api.moderation.deleteChatMessages(
        channel.id,
        id,
    );

    return {
        status: "okay",
        action: "delete_message",
        message_id: id,
    };
}

export async function setTwitchSlowChat(
    enabled: boolean,
    delay = 30,
) {
    const {api, channel} = getContext();

    if (!enabled) {
        const result =
            await api.chat.updateSettings(
                channel.id,
                {
                    slowModeEnabled: false,
                },
            );

        return {
            status: "okay",
            action: "slow_chat",
            enabled: false,
            result,
        };
    }

    const seconds = Math.floor(Number(delay));

    if (
        !Number.isFinite(seconds)
        || seconds < 3
        || seconds > 120
    ) {
        throw new Error(
            "slow chat delay must be between 3 and 120 seconds",
        );
    }

    const result =
        await api.chat.updateSettings(
            channel.id,
            {
                slowModeEnabled: true,
                slowModeDelay: seconds,
            },
        );

    return {
        status: "okay",
        action: "slow_chat",
        enabled: true,
        delay: seconds,
        result,
    };
}

export async function setTwitchEmoteOnly(
    enabled: boolean,
) {
    const {api, channel} = getContext();

    const result =
        await api.chat.updateSettings(
            channel.id,
            {
                emoteOnlyModeEnabled: enabled,
            },
        );

    return {
        status: "okay",
        action: "emote_only",
        enabled,
        result,
    };
}

export async function setTwitchFollowersOnly(
    enabled: boolean,
    delay = 0,
) {
    const {api, channel} = getContext();

    const minutes = Math.floor(Number(delay));

    if (
        enabled
        && (
            !Number.isFinite(minutes)
            || minutes < 0
            || minutes > 129_600
        )
    ) {
        throw new Error(
            "followers-only delay must be between 0 and 129600 minutes",
        );
    }

    const result =
        await api.chat.updateSettings(
            channel.id,
            enabled
                ? {
                    followerOnlyModeEnabled: true,
                    followerOnlyModeDelay: minutes,
                }
                : {
                    followerOnlyModeEnabled: false,
                },
        );

    return {
        status: "okay",
        action: "followers_only",
        enabled,
        delay:
            enabled
                ? minutes
                : null,
        result,
    };
}

export async function setTwitchSubscribersOnly(
    enabled: boolean,
) {
    const {api, channel} = getContext();

    const result =
        await api.chat.updateSettings(
            channel.id,
            {
                subscriberOnlyModeEnabled: enabled,
            },
        );

    return {
        status: "okay",
        action: "subscribers_only",
        enabled,
        result,
    };
}

export async function setTwitchUniqueChat(
    enabled: boolean,
) {
    const {api, channel} = getContext();

    const result =
        await api.chat.updateSettings(
            channel.id,
            {
                uniqueChatModeEnabled: enabled,
            },
        );

    return {
        status: "okay",
        action: "unique_chat",
        enabled,
        result,
    };
}

export async function setTwitchModerator(
    userValue: unknown,
    enabled: boolean,
) {
    const {api, channel} = getContext();
    const user = await requireUser(userValue);

    if (enabled) {
        await api.moderation.addModerator(
            channel.id,
            user.id,
        );
    } else {
        await api.moderation.removeModerator(
            channel.id,
            user.id,
        );
    }

    return {
        status: "okay",
        action:
            enabled
                ? "add_moderator"
                : "remove_moderator",
        enabled,
        user: {
            id: user.id,
            login: user.name,
            display_name: user.displayName,
        },
    };
}

export async function setTwitchVip(
    userValue: unknown,
    enabled: boolean,
) {
    const {api, channel} = getContext();
    const user = await requireUser(userValue);

    if (enabled) {
        await api.channels.addVip(
            channel.id,
            user.id,
        );
    } else {
        await api.channels.removeVip(
            channel.id,
            user.id,
        );
    }

    return {
        status: "okay",
        action:
            enabled
                ? "add_vip"
                : "remove_vip",
        enabled,
        user: {
            id: user.id,
            login: user.name,
            display_name: user.displayName,
        },
    };
}

export async function setTwitchShieldMode(
    enabled: boolean,
) {
    const {api, channel} = getContext();

    const result =
        await api.moderation
            .updateShieldModeStatus(
                channel.id,
                enabled,
            );

    return {
        status: "okay",
        action: "shield_mode",
        enabled,
        result,
    };
}
