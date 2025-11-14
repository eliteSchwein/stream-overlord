import WebsocketServer from "../clients/websocket/WebsocketServer";
import {WebSocketServer} from "ws";
import getWebsocketServer, {getWebServer} from "../App";
import {Express} from "express";
import WebServer from "../clients/webserver/WebServer";
import {getRandomInt} from "../../../helper/GeneralHelper";

export default class BaseApi {
    restEndpoint: null|string = null
    restPost: boolean = false
    websocketMethod: null|string = null

    webSocketServer: WebSocketServer
    webSocket: WebSocket
    webSocketClient: WebsocketServer
    webSocketId: number = getRandomInt(10_000)

    restServer: WebServer
    restExpress: Express

    public constructor() {
        this.webSocketClient = getWebsocketServer()
        this.webSocketServer = this.webSocketClient.getWebsocket()
        this.restServer = getWebServer()
        this.restExpress = this.restServer.getExpress()

        this.registerRest()
        this.registerWebsocket()
    }

    private registerRest() {
        if(!this.restEndpoint) return

        if(this.restPost) {
            this.restExpress.post(`/api/${this.restEndpoint}`,
                async (req, res) => {
                    const body = req.body as any
                    res.json(await this.handleRequest(body, true))
                })

            return
        }

        this.restExpress.get(`/api/${this.restEndpoint}`,
            async (req, res) => {
                res.json(await this.handleRequest({}, true))
            })
    }

    private registerWebsocket() {
        if(!this.websocketMethod) return

        this.webSocketClient.addMessageEvent(this)
    }

    public getWebsocketMethod(): string {
        return this.websocketMethod
    }

    public async handleWebsocketEvent(data: any) {
        if(data.id) this.webSocketId = data.id

        const result = await this.handle(data.params)
    }

    public sendWebsocket(method: string, data: any) {

    }

    private async handleRequest(data: any, rest: boolean = false): Promise<any> {
        const result = await this.handle(data)

        if(rest) {
            result.status = 200

            if(result.error) result.status = 400
        }

        return result
    }

    async handle(data: any): Promise<any> {

    }
}