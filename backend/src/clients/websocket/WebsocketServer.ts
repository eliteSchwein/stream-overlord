import {WebSocketServer} from "ws";
import {getConfig} from "../../helper/ConfigHelper";
import {logRegular} from "../../helper/LogHelper";
import ConnectEvent from "./events/ConnectEvent";
import MessageEvent from "./events/MessageEvent";


export default class WebsocketServer {
    websocket: WebSocketServer
    
    public initial() {
        const config = getConfig(/websocket/g)[0]

        logRegular(`initial websocket server`)

        this.websocket = new WebSocketServer({port: config.port, host: '0.0.0.0'})
    }

    public registerEvents() {
        void new ConnectEvent(this.websocket).register()
    }

    public post(method: string, data: any) {
        this.websocket.clients.forEach((client) => {
            client.send(JSON.stringify({method: method, data: data}))
        })
    }
}