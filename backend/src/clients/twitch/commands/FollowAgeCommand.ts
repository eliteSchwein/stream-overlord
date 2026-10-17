import BaseCommand from "./BaseCommand";
import {BotCommandContext} from "@twurple/easy-bot";
import {getTwitchUserInfo} from "../../../helper/TwitchUserInfoHelper";
import {translate} from "../../../helper/LocaleHelper";

function formatUnit(
    value: number,
    singularKey: string,
    pluralKey: string,
): string {
    return translate(
        value === 1
            ? singularKey
            : pluralKey,
        {value},
    );
}

function formatDurationSince(date: Date): string {
    const totalDays = Math.floor(
        Math.max(0, Date.now() - date.getTime())
        / (24 * 60 * 60 * 1000)
    );

    const years = Math.floor(totalDays / 365);
    const months = Math.floor((totalDays % 365) / 30);
    const days = (totalDays % 365) % 30;

    const parts: string[] = [];

    if (years > 0) {
        parts.push(
            formatUnit(
                years,
                "followage.duration_year_one",
                "followage.duration_year_other",
            ),
        );
    }

    if (months > 0) {
        parts.push(
            formatUnit(
                months,
                "followage.duration_month_one",
                "followage.duration_month_other",
            ),
        );
    }

    if (days > 0 || parts.length === 0) {
        parts.push(
            formatUnit(
                days,
                "followage.duration_day_one",
                "followage.duration_day_other",
            ),
        );
    }

    return parts.join(", ");
}

export default class FollowAgeCommand extends BaseCommand {
    command = "followage";

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

        const info =
            await getTwitchUserInfo(target);

        if (!info) {
            await this.reply(
                context,
                translate(
                    "followage.user_not_found",
                    {user: target},
                ),
            );
            return;
        }

        if (!info.follow?.followed_at) {
            await this.reply(
                context,
                translate(
                    "followage.not_following",
                    {user: info.display_name},
                ),
            );
            return;
        }

        await this.reply(
            context,
            translate(
                "followage.following_for",
                {
                    user: info.display_name,
                    duration: formatDurationSince(
                        new Date(info.follow.followed_at),
                    ),
                },
            ),
        );
    }
}
