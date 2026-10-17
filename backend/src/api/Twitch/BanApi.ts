import BaseApi from "../../abstracts/BaseApi";
import {banTwitchUser} from "../../helper/TwitchModerationHelper";

export default class BanApi extends BaseApi {
    restEndpoint = "twitch/moderation/ban";
    restPost = true;
    websocketMethod = "twitch_ban";

    async handle(data: any) {
        try {
            return await banTwitchUser(
                data?.user ?? data?.id ?? data?.login,
                data?.reason,
            );
        } catch (error: any) {
            return {
                error: true,
                message: error?.message ?? "ban failed",
            };
        }
    }
}
