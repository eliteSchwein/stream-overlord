import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {logWarn} from "../LogHelper";
import {
    getConfiguredCommands,
    setConfiguredCommandRuntimeEnabled,
    toggleConfiguredCommandRuntimeEnabled,
} from "../../clients/twitch/TwitchCommands";

export default class CommandMacroTask extends BaseMacroTask {
    channel = "command";

    async handle(method: string, data: any = {}) {
        const name = String(data?.name ?? data?.command ?? "")
            .trim()
            .replace(/^!+/, "");

        if (!name) {
            logWarn(`command ${method} requires command name`);
            return;
        }

        const commands = getConfiguredCommands();
        const command = commands?.[name];

        if (!command) {
            logWarn(`unknown command: ${name}`);
            return;
        }

        switch (method) {
            case "enable":
                setConfiguredCommandRuntimeEnabled(name, true);
                return;

            case "disable":
                setConfiguredCommandRuntimeEnabled(name, false);
                return;

            case "toggle":
                toggleConfiguredCommandRuntimeEnabled(name);
                return;

            default:
                logWarn(`invalid command macro method: ${method}`);
        }
    }
}
