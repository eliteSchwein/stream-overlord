import BaseApi from "../../abstracts/BaseApi";
import {readCommandFile} from "../../clients/twitch/TwitchCommands";

export default class CommandReadApi extends BaseApi {
    restEndpoint = "commands/read";
    restPost = true;
    websocketMethod = "commands_read";

    async handle(data: any): Promise<any> {
        try {
            return {
                status: "okay",
                ...readCommandFile(data?.path ?? data?.file ?? data?.name),
            };
        } catch (error: any) {
            return {error: error?.message ?? "read failed"};
        }
    }
}
