import BaseApi from "./BaseApi";
import getWebsocketServer from "../../../App";

export default class TestApi extends BaseApi {
    endpoint = 'test'
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

        getWebsocketServer().send(method, data)
    }
}