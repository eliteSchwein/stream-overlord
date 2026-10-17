import BaseApi from "../../abstracts/BaseApi";
import {getTwitchUserInfo} from "../../helper/TwitchUserInfoHelper";

export default class UserInfoApi extends BaseApi {
    restEndpoint = "twitch/user";
    restPost = true;
    websocketMethod = "twitch_user_info";

    async handle(data: any): Promise<any> {
        const user = String(
            data?.user
            ?? data?.login
            ?? data?.id
            ?? "",
        );

        if (!user) {
            return {
                error: true,
                message: "missing user",
            };
        }

        try {
            const result =
                await getTwitchUserInfo(user);

            if (!result) {
                return {
                    error: true,
                    message: "user not found",
                };
            }

            return result;
        } catch (error: any) {
            return {
                error: true,
                message:
                    error?.message
                    ?? "twitch user lookup failed",
            };
        }
    }
}
