import BaseApi from "./BaseApi";
import getWebsocketServer from "../../../App";

export default class ToggleApi extends BaseApi {
    endpoint = 'toggle'
    post = true

    async handle(req: Request) {
        const body = req.body as any

        if(!body.method) {
            return {
                error: 'method missing',
                status: 400
            }
        }

        if(!body.target) {
            return {
                error: 'target missing',
                status: 400
            }
        }

        const method = body.method
        const target = body.target

        const websocket = getWebsocketServer()

        switch (method) {
            case 'enable':
                websocket.send('toggle_element', {target: target})
                break
            case 'disable':
                websocket.send('enable_toggle_element', {target: target})
                break
            case 'toggle':
                websocket.send('disable_toggle_element', {target: target})
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