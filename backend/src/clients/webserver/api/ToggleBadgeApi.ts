import BaseApi from "./BaseApi";
import getWebsocketServer from "../../../App";

export default class ToggleBadgeApi extends BaseApi {
    endpoint = 'toggle_badge'

    async handle(req: Request) {
        const websocket = getWebsocketServer()

        websocket.send('toggle_badge', {})

        return {
            status: 200
        }
    }
}