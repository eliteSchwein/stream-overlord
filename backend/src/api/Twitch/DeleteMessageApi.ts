import BaseApi from "../../abstracts/BaseApi";
import {deleteTwitchMessage} from "../../helper/TwitchModerationHelper";

export default class DeleteMessageApi extends BaseApi {
    restEndpoint = "twitch/moderation/delete-message";
    restPost = true;
    websocketMethod = "twitch_delete_message";

    async handle(data: any) {
        try {
            return await deleteTwitchMessage(
                data?.message_id
                ?? data?.messageId
                ?? data?.id,
            );
        } catch (error: any) {
            return {
                error: true,
                message:
                    error?.message
                    ?? "delete message failed",
            };
        }
    }
}
