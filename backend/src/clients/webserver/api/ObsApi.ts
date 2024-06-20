import BaseApi from "./BaseApi";
import {logRegular} from "../../../helper/LogHelper";
import {addAlert} from "../../../helper/AlertHelper";
import {getOBSClient} from "../../../App";

export default class ObsApi extends BaseApi {
    endpoint = 'obs'
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

        const obsClient = getOBSClient()

        await obsClient.send(method, data)

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