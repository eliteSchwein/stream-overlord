import BaseApi from "../../abstracts/BaseApi";
import {getConfiguredCommands, listCommandFiles} from "../../clients/twitch/TwitchCommands";

export default class CommandListApi extends BaseApi {
    restEndpoint = "commands/list";
    restPost = true;
    websocketMethod = "commands_list";

    async handle(data: any): Promise<any> {
        try {
            return {
                files: listCommandFiles(data?.path ?? ""),
                commands: getConfiguredCommands(),
            };
        } catch (error: any) {
            return {error: error?.message ?? "list failed"};
        }
    }
}
