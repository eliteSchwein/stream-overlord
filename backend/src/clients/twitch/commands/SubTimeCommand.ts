import BaseCommand from "./BaseCommand";
import {BotCommandContext} from "@twurple/easy-bot";
import {getTwitchUserInfo} from "../../../helper/TwitchUserInfoHelper";
import {rememberTwitchSubscriptionMonthsFromBadgeInfo} from "../../../helper/TwitchSubscriptionDurationHelper";
import {translate} from "../../../helper/LocaleHelper";

function formatTier(
    tier: string | null | undefined,
): string {
    if (tier === "1000") {
        return translate("subtime.tier_1");
    }

    if (tier === "2000") {
        return translate("subtime.tier_2");
    }

    if (tier === "3000") {
        return translate("subtime.tier_3");
    }

    return tier || translate("subtime.tier_unknown");
}

export default class SubTimeCommand extends BaseCommand {
    command = "subtime";

    params = [
        {
            name: "user",
            type: "user",
            required: false,
        },
    ];

    async handle(params: any, context: BotCommandContext) {
        const target =
            params.user?.name
            ?? params.user?.displayName
            ?? context.userName;

        // For the command caller, Twitch IRC exposes the exact cumulative
        // subscriber month count in badge-info (subscriber/<months>).
        // Persist it before reading the shared user-info helper so !subtime
        // can show the duration immediately, even when no resub event occurred
        // since the bot started.
        const isSelf =
            !params.user
            || target.toLowerCase() === context.userName.toLowerCase();

        if (isSelf) {
            const chatUser: any =
                (context.msg as any)?.userInfo
                ?? (context.msg as any)?.user;

            await rememberTwitchSubscriptionMonthsFromBadgeInfo(
                context.userId,
                chatUser?.badgeInfo,
            );
        }

        const info =
            await getTwitchUserInfo(target);

        if (!info) {
            await this.reply(
                context,
                translate(
                    "subtime.user_not_found",
                    {user: target},
                ),
            );
            return;
        }

        if (!info.subscription) {
            await this.reply(
                context,
                translate(
                    "subtime.not_subscribed",
                    {user: info.display_name},
                ),
            );
            return;
        }

        const months = info.subscription.months;

        await this.reply(
            context,
            translate(
                months
                    ? "subtime.subscribed_with_months"
                    : "subtime.subscribed",
                {
                    user: info.display_name,
                    tier: formatTier(
                        info.subscription.tier,
                    ),
                    gifted:
                        info.subscription.is_gift
                            ? translate("subtime.gifted")
                            : "",
                    months: months ?? "",
                },
            ),
        );
    }
}
