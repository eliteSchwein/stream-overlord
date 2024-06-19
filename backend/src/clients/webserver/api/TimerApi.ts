import BaseApi from "./BaseApi";
import getWebsocketServer from "../../../App";
import {pushTheme, setManual} from "../../../helper/ThemeHelper";
import {activateTimer} from "../../../helper/TimerHelper";
import {logRegular} from "../../../helper/LogHelper";

export default class TimerApi extends BaseApi {
    endpoint = 'timer'
    post = true

    async handle(req: Request) {
        const body = req.body as any

        if(!body.method || !body.data) {
            return {
                error: 'method or data missing',
                status: 400
            }
        }

        const method = body.method
        const data = body.data

        const timerName = data.name

        switch (method) {
            case 'activate':
                logRegular(`activate timer ${timerName}`)
                activateTimer(timerName)
                break
            default:
                return {
                    error: 'method invalid',
                    status: 400
                }
        }

        return {
            status: 200
        }
    }
}