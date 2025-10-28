import BaseMessage from "./BaseMessage";
import {getTwitchClient} from "../../../../App";
import {removeGiveawayUser} from "../../../../helper/GiveawayHelper";

export default class RemoveGiveawayUserMessage extends BaseMessage {
    method = 'remove_giveaway_user'

    async handle(data: any) {
        if(!data['user']) return

        const user = await getTwitchClient().getBot().api.users.getUserById(data['user'])

        removeGiveawayUser(user)
    }
}