import {WebSocketServer} from "ws";
import {getConfig} from "../../helper/ConfigHelper";
import {logError, logRegular} from "../../helper/LogHelper";
import ConnectEvent from "./events/ConnectEvent";
import {getRandomInt} from "../../../../helper/GeneralHelper";


export default class WebsocketServer {
    websocket: WebSocketServer
    minimalConnections: string[] = []
    minimalEndpointBlacklist: string[] = [
        'notify_tauonmb_update',
        'notify_source_update',
        'notify_system_info',
        'notify_audio_update',
        'notify_channel_point_update',
        'notify_shield_mode'
    ]
    
    public initial() {
        const config = getConfig(/websocket/g)[0]

        logRegular(`initial websocket server`)

        this.websocket = new WebSocketServer({port: config.port, host: '0.0.0.0', maxPayload: 512 * 1024 * 1024})
    }

    public registerEvents() {
        void new ConnectEvent(this.websocket, this).register()
    }

    public send(method: string, data: any = {}) {
        this.websocket.clients.forEach((client) => {
            try {
                if(
                    this.minimalConnections.includes(`${client._socket.remoteAddress}:${client._socket.remotePort}`) &&
                    this.minimalEndpointBlacklist.includes(method)
                ) {
                    return
                }
                client.send(JSON.stringify({jsonrpc: "2.0", method: method, params: data, id: getRandomInt(10_000)}))
            } catch (error) {
                logError('request to a websocket client failed!')
                logError(JSON.stringify(error, Object.getOwnPropertyNames(error)))
            }
        })
    }

    public addMinimalConnection(client: string) {
        if(this.minimalConnections.includes(client)) return

        this.minimalConnections.push(client)
    }

    public removeMinimalConnection(client: string) {
        this.minimalConnections = this.minimalConnections.filter(
            (c) => c !== client
        );
    }
}