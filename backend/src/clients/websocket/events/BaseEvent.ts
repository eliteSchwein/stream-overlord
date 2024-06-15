import {logRegular} from "../../../helper/LogHelper";
import {WebSocketServer} from "ws";

export default class BaseEvent {
    webSocketServer: WebSocketServer;

    name: string
    eventTypes: string[]

    public constructor(webSocketServer: WebSocketServer) {
        this.webSocketServer = webSocketServer
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