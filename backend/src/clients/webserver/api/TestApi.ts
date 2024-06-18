import BaseApi from "./BaseApi";
import getWebsocketServer from "../../../App";
import {pushTheme, setManual} from "../../../helper/ThemeHelper";

export default class TestApi extends BaseApi {
    endpoint = 'test'
    post = true

    async handle(req: Request) {
        const body = req.body as any

        if(!body.method || !body.data) {
            return {
                error: 'method or assets missing',
                status: 400
            }
        }

        const method = body.method
        const data = body.data

        if(method === 'set_color') {
            setManual(data.color)
            pushTheme()

            return {
                status: 200
            }
        }

        if(method === 'reset_color') {
            setManual()
            pushTheme()

            return {
                status: 200
            }
        }

        getWebsocketServer().send(method, data)

        return {
            status: 200
        }
    }
}