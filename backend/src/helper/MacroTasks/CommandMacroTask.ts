import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {logWarn} from "../LogHelper";
import {
    getConfiguredCommands,
    resetConfiguredCommandRuntimeSetting,
    setConfiguredCommandRuntimeEnabled,
    setConfiguredCommandRuntimeSetting,
    setConfiguredCommandRuntimeSettings,
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

            case "set": {
                const settings =
                    data?.settings &&
                    typeof data.settings === "object" &&
                    !Array.isArray(data.settings)
                        ? data.settings
                        : null;

                if (settings) {
                    await setConfiguredCommandRuntimeSettings(name, settings);
                    return;
                }

                // Backward compatibility for old single-setting macros.
                await setConfiguredCommandRuntimeSetting(
                    name,
                    String(data?.setting ?? ""),
                    data?.value,
                );
                return;
            }

            case "reset":
                await resetConfiguredCommandRuntimeSetting(
                    name,
                    String(data?.setting ?? ""),
                );
                return;

            case "reset_all":
                await resetConfiguredCommandRuntimeSetting(name);
                return;

            default:
                logWarn(`invalid command macro method: ${method}`);
        }
    }
}
