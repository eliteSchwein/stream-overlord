import BaseApi from "./BaseApi";
import getWebsocketServer from "../../../App";

export default class ToggleBadgeApi extends BaseApi {
    endpoint = 'badge'
    post = true

    async handle(req: Request) {
        const body = req.body as any

        if(!body.method) {
            return {
                error: 'method missing',
                status: 400
            }
        }

        const method = body.method

        const websocket = getWebsocketServer()

        switch (method) {
            case 'expand':
                websocket.send('expand_badge', {})
                break
            case 'collapse':
                websocket.send('collapse_badge', {})
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