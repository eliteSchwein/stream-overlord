import BaseApi from "../../abstracts/BaseApi";
import {setTwitchFollowersOnly} from "../../helper/TwitchModerationHelper";

export default class FollowersOnlyApi extends BaseApi {
    restEndpoint = "twitch/chat/followers-only";
    restPost = true;
    websocketMethod = "twitch_followers_only";

    async handle(data: any) {
        try {
            return await setTwitchFollowersOnly(
                data?.enabled !== false,
                Number(
                    data?.delay
                    ?? data?.duration
                    ?? 0,
                ),
            );
        } catch (error: any) {
            return {
                error: true,
                message:
                    error?.message
                    ?? "followers-only update failed",
            };
        }
    }
}
