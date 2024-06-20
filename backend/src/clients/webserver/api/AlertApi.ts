import BaseApi from "./BaseApi";
import {logRegular} from "../../../helper/LogHelper";
import {addAlert} from "../../../helper/AlertHelper";

export default class AlertApi extends BaseApi {
    endpoint = 'alert'
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

        switch (method) {
            case 'add':
                logRegular(`add alert`)
                addAlert(data)
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