import {WebSocketServer} from "ws";
import {getConfig} from "../../helper/ConfigHelper";
import {logError, logRegular, logWarn} from "../../helper/LogHelper";
import ConnectEvent from "./events/ConnectEvent";


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

    public send(method: string, data: any) {
        this.websocket.clients.forEach((client) => {
            try {
                client.send(JSON.stringify({method: method, data: data}))
            } catch (error) {
                logError('request to a websocket client failed!')
                logError(JSON.stringify(error, Object.getOwnPropertyNames(error)))
            }
        })
    }
}