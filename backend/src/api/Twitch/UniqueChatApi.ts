import BaseApi from "../../abstracts/BaseApi";
import {setTwitchUniqueChat} from "../../helper/TwitchModerationHelper";

export default class UniqueChatApi extends BaseApi {
    restEndpoint = "twitch/chat/unique";
    restPost = true;
    websocketMethod = "twitch_unique_chat";

    async handle(data: any) {
        try {
            return await setTwitchUniqueChat(
                data?.enabled !== false,
            );
        } catch (error: any) {
            return {
                error: true,
                message:
                    error?.message
                    ?? "unique chat update failed",
            };
        }
    }
}
