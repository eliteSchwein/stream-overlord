import BaseApi from "../../abstracts/BaseApi";
import {unbanTwitchUser} from "../../helper/TwitchModerationHelper";

export default class UnbanApi extends BaseApi {
    restEndpoint = "twitch/moderation/unban";
    restPost = true;
    websocketMethod = "twitch_unban";

    async handle(data: any) {
        try {
            return await unbanTwitchUser(
                data?.user ?? data?.id ?? data?.login,
            );
        } catch (error: any) {
            return {
                error: true,
                message: error?.message ?? "unban failed",
            };
        }
    }
}
