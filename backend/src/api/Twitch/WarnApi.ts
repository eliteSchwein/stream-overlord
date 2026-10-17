import BaseApi from "../../abstracts/BaseApi";
import {warnTwitchUser} from "../../helper/TwitchModerationHelper";

export default class WarnApi extends BaseApi {
    restEndpoint = "twitch/moderation/warn";
    restPost = true;
    websocketMethod = "twitch_warn";

    async handle(data: any) {
        try {
            return await warnTwitchUser(
                data?.user ?? data?.id ?? data?.login,
                String(data?.reason ?? ""),
            );
        } catch (error: any) {
            return {
                error: true,
                message: error?.message ?? "warn failed",
            };
        }
    }
}
