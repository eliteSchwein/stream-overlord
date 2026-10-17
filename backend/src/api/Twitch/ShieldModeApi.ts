import BaseApi from "../../abstracts/BaseApi";
import {setTwitchShieldMode} from "../../helper/TwitchModerationHelper";

export default class ShieldModeApi extends BaseApi {
    restEndpoint = "twitch/moderation/shield-mode";
    restPost = true;
    websocketMethod = "twitch_shield_mode";

    async handle(data: any) {
        try {
            return await setTwitchShieldMode(
                data?.enabled !== false,
            );
        } catch (error: any) {
            return {
                error: true,
                message:
                    error?.message
                    ?? "shield-mode update failed",
            };
        }
    }
}
