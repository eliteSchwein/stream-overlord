import {WebSocket, WebSocketServer} from "ws";
import {logError} from "../../../../helper/LogHelper";
import {getRandomInt} from "../../../../../../helper/GeneralHelper";
import WebsocketServer from "../../WebsocketServer";

export default class BaseMessage {
    webSocketServer: WebSocketServer
    webSocket: WebSocket
    client: WebsocketServer
    method: string
    id: number = getRandomInt(10_000)

    public constructor(webSocketServer: WebSocketServer, webSocket: WebSocket, client: WebsocketServer) {
        this.webSocketServer = webSocketServer
        this.webSocket = webSocket
        this.client = client
    }

    public async handleMessage(data: any) {
        if(data.method !== this.method) { return }
        if(data.id) {
            this.id = data.id
        }

        await this.handle(data.params)
    }


    public send(method: string, data: any = {}) {
        try {
            this.webSocket.send(JSON.stringify({jsonrpc: "2.0", method: method, params: data, id: this.id}))
        } catch (error) {
            logError('request to a websocket client failed!')
            logError(JSON.stringify(error, Object.getOwnPropertyNames(error)))
        }
    }

    async handle(data: any) {

    }
}