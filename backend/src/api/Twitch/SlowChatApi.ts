import BaseApi from "../../abstracts/BaseApi";
import {setTwitchSlowChat} from "../../helper/TwitchModerationHelper";

export default class SlowChatApi extends BaseApi {
    restEndpoint = "twitch/chat/slow";
    restPost = true;
    websocketMethod = "twitch_slow_chat";

    async handle(data: any) {
        try {
            return await setTwitchSlowChat(
                data?.enabled !== false,
                Number(
                    data?.delay
                    ?? data?.duration
                    ?? 30,
                ),
            );
        } catch (error: any) {
            return {
                error: true,
                message:
                    error?.message
                    ?? "slow chat update failed",
            };
        }
    }
}
