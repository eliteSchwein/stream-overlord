import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {logRegular, logWarn} from "../LogHelper";

export default class KeyboardMacroTask extends BaseMacroTask {
    channel = "keyboard"

    async handle(method: string, data: any = {}) {
        logRegular(`trigger keyboard: ${method}`);

        switch (method) {
            case "press": {
                const keys = Array.isArray(data.keys)
                    ? data.keys.map((key: any) => String(key).trim()).filter(Boolean)
                    : String(data.keys ?? "")
                        .split(",")
                        .map((key) => key.trim())
                        .filter(Boolean);

                this.websocket.send("trigger_keyboard", {
                    name: data.name ?? "macro",
                    keys,
                    duration: data.duration,
                });

                break;
            }

            default: {
                logWarn(`invalid keyboard method: ${method}`);
                break;
            }
        }
    }
}
