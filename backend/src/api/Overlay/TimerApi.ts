import BaseApi from "../../abstracts/BaseApi";
import {logRegular} from "../../helper/LogHelper";
import {activateTimer} from "../../helper/TimerHelper";

export default class TimerApi extends BaseApi {
    restEndpoint = 'timer'
    restPost = true
    websocketMethod = 'timer'

    async handle(data: any): Promise<any>
    {
        if(!data.state) return {"error": "missing state"}

        const timerName = data.data.name

        switch (data.state) {
            case 'start':
            case 'activate':
                logRegular(`activate timer ${timerName}`)
                activateTimer(timerName)
                break
            default: return {"error": "invalid state"}
        }
    }
}