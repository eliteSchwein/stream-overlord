import WebsocketServer from "../clients/websocket/WebsocketServer";
import {WebSocketServer} from "ws";
import getWebsocketServer, {getWebServer} from "../App";
import {Express} from "express";
import WebServer from "../clients/webserver/WebServer";

export default class BaseApi {
    restEndpoint: null|string = null
    restPostOnly: boolean = false
    websocketMethod: null|string = null
    webSocketServer: WebSocketServer
    webSocket: WebSocket
    webSocketClient: WebsocketServer
    restServer: WebServer
    restExpress: Express

    public constructor() {
        this.webSocketClient = getWebsocketServer()
        this.webSocketServer = this.webSocketClient.getWebsocket()
        this.restServer = getWebServer()
        this.restExpress = this.restServer.getExpress()
    }

    public sendWebsocket(method: string, data: any) {

    }
}