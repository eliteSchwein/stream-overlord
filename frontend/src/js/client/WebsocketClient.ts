import {Websocket, WebsocketEvent} from "websocket-ts";
import {getConfig} from "../helper/ConfigHelper";
import {getRandomInt, sleep} from "../../../../helper/GeneralHelper";

export default class WebsocketClient {
    websocket: Websocket

    public async connect() {
        const config = getConfig(/websocket/g)[0]

        this.websocket = new Websocket('ws://' + window.location.hostname + ':' + config.port)

        this.websocket.addEventListener(WebsocketEvent.open, (event) => {
            console.log('Websocket connected')
            this.registerEndpoints(['notify_game_update', 'notify_shield_mode'])
        })

        this.websocket.addEventListener(WebsocketEvent.close, (event) => {
            console.log('Websocket closed')

            // @ts-ignore
            location.reload(true)
        })

        await sleep(250)
    }

    public getWebsocket() {
        return this.websocket
    }

    public send(method: string, data: any = {}) {
        this.websocket.send(JSON.stringify({jsonrpc: "2.0", method: method, params: data, id: getRandomInt(10_000)}))
    }

    public editColor(color: string|undefined = undefined) {
        this.send('set_color', {color: color})
    }

    public clearEvent(eventUuid: string) {
        this.send('remove_event', {'event-uuid': eventUuid})
    }

    public registerEndpoint(endpoint: string): void {
        this.send('register_endpoints', [endpoint])
    }

    public registerEndpoints(endpoints: string[]): void {
        if(endpoints.length === 0) return
        this.send('register_endpoints', endpoints)
    }
}