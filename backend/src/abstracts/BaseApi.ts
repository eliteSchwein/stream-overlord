import WebsocketServer from "../clients/websocket/WebsocketServer";
import {WebSocketServer} from "ws";
import {Express} from "express";
import WebServer from "../clients/webserver/WebServer";
import {getRandomInt} from "../../../helper/GeneralHelper";
import {logError, logRegular} from "../helper/LogHelper";

export default class BaseApi {
    restEndpoint: null|string
    restPost: boolean
    websocketMethod: null|string

    webSocketServer: WebSocketServer
    webSocket: WebSocket
    webSocketClient: WebsocketServer
    webSocketId: number = getRandomInt(10_000)

    restServer: WebServer
    restExpress: Express

    public constructor(
        websocketServer: WebsocketServer,
        restServer: WebServer
    ) {
        this.webSocketClient = websocketServer
        this.webSocketServer = this.webSocketClient.getWebsocket()
        this.restServer = restServer
        this.restExpress = this.restServer.getExpress()
    }

    public registerEndpoints() {
        this.registerRest()
        this.registerWebsocket()
    }

    private registerRest() {
        if(!this.restEndpoint) return

        logRegular(`register rest endpoint: /api/${this.restEndpoint}`)

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

        logRegular(`register websocket method: ${this.websocketMethod}`)

        this.webSocketClient.addMessageEvent(this)
    }

    public getWebsocketMethod(): string {
        return this.websocketMethod
    }

    public async handleWebsocketEvent(webSocket: WebSocket, data: any) {
        this.webSocket = webSocket
        if(data.id) this.webSocketId = data.id

        const result = await this.handle(data.params)
        const resultMethod = `result_${this.websocketMethod}`

        if(!result) {
            this.sendWebsocket(resultMethod, {status: 'okay'})
            return
        }

        return this.sendWebsocket(resultMethod, result)
    }

    public sendWebsocket(method: string, data: any) {
        if(!this.webSocket) return

        try {
            this.webSocket.send(JSON.stringify({jsonrpc: "2.0", method: method, params: data, id: this.webSocketId}))
        } catch (error) {
            logError('request to a websocket client failed!')
            logError(JSON.stringify(error, Object.getOwnPropertyNames(error)))
        }
    }

    private async handleRequest(data: any, rest: boolean = false): Promise<any> {
        let result: any = await this.handle(data)

        if(rest) {
            const restResult = {
                data: result,
                status: 200
            }

            if(result.error) restResult.status = 400

            result = restResult
        }

        return result
    }

    async handle(data: any): Promise<any> {

    }
}