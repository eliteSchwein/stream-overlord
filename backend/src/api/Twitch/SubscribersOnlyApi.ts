import BaseApi from "../../abstracts/BaseApi";
import {setTwitchSubscribersOnly} from "../../helper/TwitchModerationHelper";

export default class SubscribersOnlyApi extends BaseApi {
    restEndpoint = "twitch/chat/subscribers-only";
    restPost = true;
    websocketMethod = "twitch_subscribers_only";

    async handle(data: any) {
        try {
            return await setTwitchSubscribersOnly(
                data?.enabled !== false,
            );
        } catch (error: any) {
            return {
                error: true,
                message:
                    error?.message
                    ?? "subscribers-only update failed",
            };
        }
    }
}
