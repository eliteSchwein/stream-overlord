import BaseCommand from "./BaseCommand";
import {addGiveawayUser, hasGiveawayUser, isGiveawayActive} from "../../../helper/GiveawayHelper";
import {getGiveawaySettings, getPrimaryChannel} from "../../../helper/ConfigHelper";
import {translate} from "../../../helper/LocaleHelper";
import {checkTwitchAccessRequirements, formatAccessDuration, formatSubTier} from "../../../helper/TwitchAccessRequirementHelper";


export default class GiveawayEnterCommand extends BaseCommand {
    command = getGiveawaySettings().giveawayCommand;
    globalCooldown = 0;
    userCooldown = 0;

    async handle(_params: any, context: any) {
        const settings = getGiveawaySettings();

        // Ignore stale command instances after giveawayCommand was changed and
        // the Twitch command bot is still being replaced/reconnected.
        if (this.command.toLowerCase() !== settings.giveawayCommand.toLowerCase()) {
            return;
        }

        if (!isGiveawayActive()) {
            await this.replyCommandError(context, translate("giveaway.inactive"));
            return;
        }

        const user = await this.bot.api.users.getUserById(context.userId);
        if (!user) return;

        if (hasGiveawayUser(user)) {
            await this.replyCommandError(context, translate("giveaway.already_registered"));
            return;
        }

        const primaryChannel = getPrimaryChannel();
        const broadcasterId = primaryChannel.id;
        const channelName = context.broadcasterName;

        const accessResult = await checkTwitchAccessRequirements({
            userId: context.userId,
            userName: context.userName,
            channelName: context.broadcasterName,
            broadcasterId,
            badgeInfo: (context.msg as any)?.userInfo?.badgeInfo,
            requirements: settings,
        });

        if (!accessResult.allowed) {
            const data = accessResult.data ?? {};
            await this.replyCommandError(
                context,
                translate(
                    `eligibility.${accessResult.code ?? "user_not_found"}`,
                    {
                        duration: formatAccessDuration(data.required_seconds ?? 0),
                        months: data.required_months ?? 0,
                        tier: formatSubTier(data.required_tier ?? 1000),
                    },
                ),
            );
            return;
        }

        const added = await addGiveawayUser(user);

        // The giveaway can end while Twitch eligibility checks are in flight.
        // addGiveawayUser() is the authoritative guard and refuses inactive giveaways.
        if (!added) {
            if (!isGiveawayActive()) {
                await this.replyCommandError(context, translate("giveaway.inactive"));
                return;
            }

            if (hasGiveawayUser(user)) {
                await this.replyCommandError(context, translate("giveaway.already_registered"));
            }
            return;
        }

        await this.reply(context, translate("giveaway.registered"));
    }
}
