import BaseApi from "../../abstracts/BaseApi";
import {setConfiguredCommandRuntimeEnabled} from "../../clients/twitch/TwitchCommands";

export default class CommandToggleApi extends BaseApi {
    restEndpoint = "commands/toggle";
    restPost = true;
    websocketMethod = "commands_toggle";

    async handle(data: any): Promise<any> {
        try {
            const name = String(data?.name ?? "").trim();

            if (!name) {
                return {error: "command name is required"};
            }

            if (typeof data?.enabled !== "boolean") {
                return {error: "enabled must be boolean"};
            }

            return {
                command: setConfiguredCommandRuntimeEnabled(
                    name,
                    data.enabled,
                ),
            };
        } catch (error: any) {
            return {error: error?.message ?? "command toggle failed"};
        }
    }
}
