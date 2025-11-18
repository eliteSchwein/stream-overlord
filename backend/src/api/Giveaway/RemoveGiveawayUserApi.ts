import BaseApi from "../../abstracts/BaseApi";
import {getTwitchClient} from "../../App";
import {removeGiveawayUser} from "../../helper/GiveawayHelper";

export default class RemoveGiveawayUserApi extends BaseApi {
    restEndpoint = 'giveaway/remove_user'
    restPost = true
    websocketMethod = 'remove_giveaway_user'

    async handle(data: any): Promise<any>
    {
        if(!data.user) return {"error": "missing user"}
        
        const user = await getTwitchClient().getBot().api.users.getUserById(data['user'])

        removeGiveawayUser(user)
    }
}