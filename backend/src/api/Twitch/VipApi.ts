import BaseApi from "../../abstracts/BaseApi";
import {setTwitchVip} from "../../helper/TwitchModerationHelper";

export default class VipApi extends BaseApi {
    restEndpoint = "twitch/moderation/vip";
    restPost = true;
    websocketMethod = "twitch_vip";

    async handle(data: any) {
        try {
            const action =
                String(
                    data?.action
                    ?? "add",
                ).toLowerCase();

            return await setTwitchVip(
                data?.user ?? data?.id ?? data?.login,
                action !== "remove",
            );
        } catch (error: any) {
            return {
                error: true,
                message:
                    error?.message
                    ?? "VIP update failed",
            };
        }
    }
}
