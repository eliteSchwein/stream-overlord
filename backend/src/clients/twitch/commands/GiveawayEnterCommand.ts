import BaseCommand from "./BaseCommand";
import {addGiveawayUser, hasGiveawayUser, isGiveawayActive} from "../../../helper/GiveawayHelper";
import {getGiveawaySettings, getPrimaryChannel} from "../../../helper/ConfigHelper";
import {hasModerator, hasVip} from "../helper/PermissionHelper";
import {translate} from "../../../helper/LocaleHelper";

function humanDuration(seconds: number) {
    if (seconds % 86400 === 0) return `${seconds / 86400}d`;
    if (seconds % 3600 === 0) return `${seconds / 3600}h`;
    if (seconds % 60 === 0) return `${seconds / 60}m`;
    return `${seconds}s`;
}

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

        if (settings.require_moderator && context.userId !== broadcasterId && !hasModerator(channelName, context.userId)) {
            await this.replyCommandError(context, translate("giveaway.moderator_required"));
            return;
        }

        if (settings.require_vip && context.userId !== broadcasterId && !hasVip(channelName, context.userId)) {
            await this.replyCommandError(context, translate("giveaway.vip_required"));
            return;
        }

        if (settings.require_subscriber && context.userId !== broadcasterId) {
            const subscriptions = await this.bot.api.subscriptions.getSubscriptions(broadcasterId, {
                userId: context.userId,
                limit: 1,
            } as any);

            if (!subscriptions.data?.length) {
                await this.replyCommandError(context, translate("giveaway.subscriber_required"));
                return;
            }
        }

        if ((settings.require_follower || settings.minimum_follow_seconds > 0) && context.userId !== broadcasterId) {
            const followerData = await this.bot.api.channels.getChannelFollowers(broadcasterId, context.userId);
            const follower = followerData.data?.[0];

            if (!follower) {
                await this.replyCommandError(context, translate("giveaway.follow_required"));
                return;
            }

            if (settings.minimum_follow_seconds > 0) {
                const followDate = follower.followDate;
                const followedSeconds = followDate
                    ? Math.max(0, Math.floor((Date.now() - followDate.getTime()) / 1000))
                    : 0;

                if (followedSeconds < settings.minimum_follow_seconds) {
                    await this.replyCommandError(context, translate("giveaway.follow_too_short", {
                        duration: humanDuration(settings.minimum_follow_seconds),
                    }));
                    return;
                }
            }
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
