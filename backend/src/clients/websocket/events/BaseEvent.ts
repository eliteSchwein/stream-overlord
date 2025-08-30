import {logRegular} from "../../../helper/LogHelper";
import {WebSocketServer} from "ws";
import WebsocketServer from "../WebsocketServer";

export default class BaseEvent {
    webSocketServer: WebSocketServer;
    client: WebsocketServer

    name: string
    eventTypes: string[]

    public constructor(webSocketServer: WebSocketServer, client: WebsocketServer) {
        this.webSocketServer = webSocketServer
        this.client = client
    }

    register() {
        logRegular(`register event ${this.name}`)

        for(const eventType of this.eventTypes) {
            this.webSocketServer.on(eventType, (event: any) => void this.handle(event))
        }
    }

    async handle(event: any) {

    }
}