import BaseApi from "../../abstracts/BaseApi";
import {editCommandFile} from "../../clients/twitch/TwitchCommands";

export default class CommandEditApi extends BaseApi {
    restEndpoint = "commands/edit";
    restPost = true;
    websocketMethod = "commands_edit";

    async handle(data: any): Promise<any> {
        try {
            return {
                status: "okay",
                ...editCommandFile(data?.path ?? data?.file ?? data?.name, data?.content ?? ""),
            };
        } catch (error: any) {
            return {error: error?.message ?? "edit failed"};
        }
    }
}
