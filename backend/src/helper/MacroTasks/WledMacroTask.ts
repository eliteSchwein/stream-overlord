import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {setLedColor} from "../WledHelper";
import {logRegular, logWarn} from "../LogHelper";

export default class WledMacroTask extends BaseMacroTask {
    channel = "wled"

    async handle(method: string, data: any = {}) {
        logRegular(`trigger wled: ${method}`);

        switch (method) {
            case "custom": {
                if (!data || typeof data !== "object") {
                    logWarn(`wled custom requires data`);
                    return;
                }

                await setLedColor(data);
                break;
            }

            case "off": {
                await setLedColor({});
                break;
            }

            default: {
                logWarn(`invalid wled method: ${method}`);
                break;
            }
        }
    }
}
