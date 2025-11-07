import BaseCommand from "./BaseCommand";
import {addGiveawayUser, hasGiveawayUser, isGiveawayActive} from "../../../helper/GiveawayHelper";
import {getPrimaryChannel} from "../../../helper/ConfigHelper";

export default class GiveawayEnterCommand extends BaseCommand {
    command = 'ticket'

    async handle(params: any, context: any) {
        if(!isGiveawayActive()) {
            await this.replyCommandError(context, "Es läuft derzeit keine Verlosung!")
            return
        }

        const user = await this.bot.api.users.getUserById(context.userId)

        if(hasGiveawayUser(user)) {
            await context.reply("Du bist bereits in der Verlosung!")
            return
        }

        //const broadcasterId = getPrimaryChannel().id
        //const targetUserId = user.id

        //const followerData = await this.bot.api.channels.getChannelFollowers(broadcasterId, targetUserId)

        //const followDate = followerData.data[0]?.followDate

        //if(!followerData.data[0]) {
        //    await this.replyCommandError(context, "Du musst mindestens 7 Tage folgen um teilnehmen zu können!")
        //  return
        //}

        //const daysSinceFollow =
        //        followDate
        //        ? Math.max(0, Math.floor((Date.now() - followDate.getTime()) / 86_400_000))
        //        : 0;

        //if(daysSinceFollow < 7) {
        //    await this.replyCommandError(context, "Du musst mindestens 7 Tage folgen um teilnehmen zu können!")
        //    return
        //}

        addGiveawayUser(user)

        await context.reply("Du bist nun in der Verlosung!")
    }
}