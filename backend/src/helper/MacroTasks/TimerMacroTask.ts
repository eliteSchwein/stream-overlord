import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {startTimer} from "../TimerHelper";
import {logRegular, logWarn} from "../LogHelper";

export default class TimerMacroTask extends BaseMacroTask {
    channel = "timer"

    async handle(method: string, data: any = {}) {
        logRegular(`trigger timer: ${method}`);

        switch (method) {
            case "start": {
                const started = startTimer(data);

                if (!started) {
                    logWarn(`timer start requires valid time`);
                }

                break;
            }

            default: {
                logWarn(`invalid timer method: ${method}`);
                break;
            }
        }
    }
}
