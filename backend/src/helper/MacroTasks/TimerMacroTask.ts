import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {addTimerTime, pauseTimer, reduceTimerTime, startTimer, stopTimer} from "../TimerHelper";
import {logRegular, logWarn} from "../LogHelper";

export default class TimerMacroTask extends BaseMacroTask {
    channel = "timer"

    async handle(method: string, data: any = {}) {
        logRegular(`trigger timer: ${method}`);

        const name = String(data.name ?? "").trim();

        switch (method) {
            case "start": {
                if (!startTimer(data)) {
                    logWarn(`timer start requires valid name and time`);
                }
                break;
            }

            case "add_time": {
                if (!addTimerTime(name, data)) {
                    logWarn(`timer add_time requires an existing timer and valid time`);
                }
                break;
            }

            case "reduce_time": {
                if (!reduceTimerTime(name, data)) {
                    logWarn(`timer reduce_time requires an existing timer and valid time`);
                }
                break;
            }

            case "pause": {
                if (!pauseTimer(name)) {
                    logWarn(`timer pause requires an existing timer name`);
                }
                break;
            }

            case "stop": {
                if (!stopTimer(name)) {
                    logWarn(`timer stop requires an existing timer name`);
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
