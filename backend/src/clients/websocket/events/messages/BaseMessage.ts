import {WebSocket, WebSocketServer} from "ws";
import {logError} from "../../../../helper/LogHelper";

export default class BaseMessage {
    webSocketServer: WebSocketServer
    webSocket: WebSocket
    method: string

    public constructor(webSocketServer: WebSocketServer, webSocket: WebSocket) {
        this.webSocketServer = webSocketServer
        this.webSocket = webSocket
    }

    public async handleMessage(data: any) {
        if(data.method !== this.method) { return}

        await this.handle(data.data)
    }


    public send(method: string, data: any) {
        try {
            this.webSocket.send(JSON.stringify({method: method, data: data}))
        } catch (error) {
            logError('request to a websocket client failed!')
            logError(JSON.stringify(error, Object.getOwnPropertyNames(error)))
        }
    }

    async handle(data: any) {

    }
}