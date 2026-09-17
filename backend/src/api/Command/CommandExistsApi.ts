import BaseApi from "../../abstracts/BaseApi";
import {resolveCommandName} from "../../clients/twitch/TwitchCommands";

export default class CommandExistsApi extends BaseApi {
    restEndpoint = "commands/exists";
    restPost = true;
    websocketMethod = "commands_exists";

    async handle(data: any): Promise<any> {
        const name = String(data?.name ?? "").trim();

        if (!name) {
            return {error: "command name is required"};
        }

        const commandName = resolveCommandName(name);

        return {
            name,
            command_name: commandName ?? null,
            exists: commandName !== undefined,
        };
    }
}
