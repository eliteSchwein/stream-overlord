import BaseApi from "./BaseApi";
import getWebsocketServer from "../../../App";
import {pushGameInfo, setManualColor} from "../../../helper/GameHelper";
import {Websocket} from "websocket-ts";
import {getConfig} from "../../../helper/ConfigHelper";
import {waitUntil} from "async-wait-until";
import {addAlert} from "../../../helper/AlertHelper";

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

        if(method === 'set_color') {
            setManualColor(data.color)
            pushGameInfo()

            return {
                status: 200
            }
        }

        if(method === 'alert') {
            addAlert(data)

            return {
                status: 200
            }
        }

        if(method === 'reset_color') {
            setManualColor()
            pushGameInfo()

            return {
                status: 200
            }
        }

        getWebsocketServer().send(method, data)

        const config = getConfig(/websocket/g)[0]

        const websocketClient = new Websocket(`ws://localhost:${config.port}`)

        await waitUntil(() => websocketClient.underlyingWebsocket.readyState === websocketClient.underlyingWebsocket.OPEN)

        websocketClient.send(JSON.stringify({method: method, data: data}))

        websocketClient.close()

        return {
            status: 200
        }
    }
}