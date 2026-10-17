import BaseApi from "../../abstracts/BaseApi";
import {setTwitchModerator} from "../../helper/TwitchModerationHelper";

export default class ModeratorApi extends BaseApi {
    restEndpoint = "twitch/moderation/moderator";
    restPost = true;
    websocketMethod = "twitch_moderator";

    async handle(data: any) {
        try {
            const action =
                String(
                    data?.action
                    ?? "add",
                ).toLowerCase();

            return await setTwitchModerator(
                data?.user ?? data?.id ?? data?.login,
                action !== "remove",
            );
        } catch (error: any) {
            return {
                error: true,
                message:
                    error?.message
                    ?? "moderator update failed",
            };
        }
    }
}
