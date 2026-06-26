import BaseApi from "../../abstracts/BaseApi";
import {moveCommandFile} from "../../clients/twitch/TwitchCommands";

export default class CommandMoveApi extends BaseApi {
    restEndpoint = "commands/move";
    restPost = true;
    websocketMethod = "commands_move";

    async handle(data: any): Promise<any> {
        try {
            return {
                status: "okay",
                ...moveCommandFile(data?.source, data?.target),
            };
        } catch (error: any) {
            return {error: error?.message ?? "move failed"};
        }
    }
}
