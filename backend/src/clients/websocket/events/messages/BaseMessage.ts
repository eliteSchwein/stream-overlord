import {WebSocket, WebSocketServer} from "ws";

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

    async handle(data: any) {

    }
}