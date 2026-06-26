import BaseApi from "../../abstracts/BaseApi";
import {logRegular} from "../../helper/LogHelper";
import {startTimer} from "../../helper/TimerHelper";

export default class TimerApi extends BaseApi {
    restEndpoint = "timer";
    restPost = true;
    websocketMethod = "timer";

    async handle(data: any): Promise<any> {
        if (!data.state) return {error: "missing state"};

        switch (data.state) {
            case "start": {
                const timerData = data.data ?? {};

                logRegular(`start timer ${timerData.name ?? ""}`);

                const started = startTimer(timerData);

                if (!started) {
                    return {error: "timer start requires valid name and time"};
                }

                return {
                    status: "okay",
                };
            }

            default:
                return {error: "invalid state"};
        }
    }
}