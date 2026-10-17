import BaseApi from "../../abstracts/BaseApi";
import {setTwitchEmoteOnly} from "../../helper/TwitchModerationHelper";

export default class EmoteOnlyApi extends BaseApi {
    restEndpoint = "twitch/chat/emote-only";
    restPost = true;
    websocketMethod = "twitch_emote_only";

    async handle(data: any) {
        try {
            return await setTwitchEmoteOnly(
                data?.enabled !== false,
            );
        } catch (error: any) {
            return {
                error: true,
                message:
                    error?.message
                    ?? "emote-only update failed",
            };
        }
    }
}
