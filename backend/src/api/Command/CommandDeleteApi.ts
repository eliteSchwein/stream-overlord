import BaseApi from "../../abstracts/BaseApi";
import {deleteCommandFile} from "../../clients/twitch/TwitchCommands";

export default class CommandDeleteApi extends BaseApi {
    restEndpoint = "commands/delete";
    restPost = true;
    websocketMethod = "commands_delete";

    async handle(data: any): Promise<any> {
        try {
            return {
                status: "okay",
                ...deleteCommandFile(data?.path ?? data?.file ?? data?.name),
            };
        } catch (error: any) {
            return {error: error?.message ?? "delete failed"};
        }
    }
}
