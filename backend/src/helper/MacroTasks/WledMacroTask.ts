import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {setLedColor} from "../WledHelper";
import {logRegular, logWarn} from "../LogHelper";

export default class WledMacroTask extends BaseMacroTask {
    channel = "wled"

    async handle(method: string, data: any = {}) {
        logRegular(`trigger wled: ${method}`);

        switch (method) {
            case "custom": {
                if (!data?.name) {
                    logWarn(`wled custom requires name`);
                    return;
                }

                await setLedColor({
                    [data.name]: data,
                });
                break;
            }

            case "off": {
                if (!data?.name) {
                    logWarn(`wled off requires name`);
                    return;
                }

                await setLedColor({
                    [data.name]: {
                        red: 0,
                        green: 0,
                        blue: 0,
                        white: 0,
                        brightness: 0,
                        effect: 0,
                    },
                });
                break;
            }

            default: {
                logWarn(`invalid wled method: ${method}`);
                break;
            }
        }
    }
}
