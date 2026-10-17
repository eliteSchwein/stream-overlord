import BaseApi from "../../abstracts/BaseApi";
import {timeoutTwitchUser} from "../../helper/TwitchModerationHelper";

export default class TimeoutApi extends BaseApi {
    restEndpoint = "twitch/moderation/timeout";
    restPost = true;
    websocketMethod = "twitch_timeout";

    async handle(data: any) {
        try {
            return await timeoutTwitchUser(
                data?.user ?? data?.id ?? data?.login,
                Number(data?.duration ?? 60),
                data?.reason,
            );
        } catch (error: any) {
            return {
                error: true,
                message: error?.message ?? "timeout failed",
            };
        }
    }
}
