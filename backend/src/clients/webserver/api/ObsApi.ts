import BaseApi from "./BaseApi";
import {getOBSClient} from "../../../App";
import {logRegular} from "../../../helper/LogHelper";

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

        logRegular(`trigger obs command: ${method}`)

        return {
            status: 200
        }
    }
}