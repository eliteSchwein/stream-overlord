import BaseApi from "../../abstracts/BaseApi";
import {logRegular} from "../../helper/LogHelper";
import {addTimerTime, pauseTimer, reduceTimerTime, startTimer, stopTimer} from "../../helper/TimerHelper";

export default class TimerApi extends BaseApi {
    restEndpoint = "timer";
    restPost = true;
    websocketMethod = "timer";

    async handle(data: any): Promise<any> {
        if (!data.state) return {error: "missing state"};

        const timerData = data.data ?? {};
        const name = String(timerData.name ?? "").trim();

        logRegular(`${data.state} timer ${name}`);

        switch (data.state) {
            case "start":
                if (!startTimer(timerData)) {
                    return {error: "timer start requires valid name and time"};
                }
                break;

            case "add_time":
                if (!addTimerTime(name, timerData)) {
                    return {error: "timer add_time requires an existing timer and valid time"};
                }
                break;

            case "reduce_time":
                if (!reduceTimerTime(name, timerData)) {
                    return {error: "timer reduce_time requires an existing timer and valid time"};
                }
                break;

            case "pause":
                if (!pauseTimer(name)) {
                    return {error: "timer pause requires an existing timer name"};
                }
                break;

            case "stop":
                if (!stopTimer(name)) {
                    return {error: "timer stop requires an existing timer name"};
                }
                break;

            default:
                return {error: "invalid state"};
        }

        return {status: "okay"};
    }
}
