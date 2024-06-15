import {WebSocketServer} from "ws";
import {getConfig} from "../../helper/ConfigHelper";
import {logRegular} from "../../helper/LogHelper";
import ConnectEvent from "./events/ConnectEvent";


export default class WebsocketServer {
    websocket: WebSocketServer
    
    public initial() {
        const config = getConfig()['websocket']

        logRegular(`initial websocket server`)

        this.websocket = new WebSocketServer({port: config.port, host: '0.0.0.0'})
    }

    public registerEvents() {
        void new ConnectEvent(this.websocket).register()
    }
}