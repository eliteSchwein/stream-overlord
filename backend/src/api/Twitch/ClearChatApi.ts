import BaseApi from "../../abstracts/BaseApi";
import {clearTwitchChat} from "../../helper/TwitchModerationHelper";

export default class ClearChatApi extends BaseApi {
    restEndpoint = "twitch/moderation/clear-chat";
    restPost = true;
    websocketMethod = "twitch_clear_chat";

    async handle() {
        try {
            return await clearTwitchChat();
        } catch (error: any) {
            return {
                error: true,
                message: error?.message ?? "clear chat failed",
            };
        }
    }
}
