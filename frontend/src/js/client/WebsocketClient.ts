import {Websocket, WebsocketEvents} from "websocket-ts";
import {getConfig} from "../helper/ConfigHelper";
import {sleep} from "../../../../helper/GeneralHelper";

export default class WebsocketClient {
    websocket: Websocket

    public async connect() {
        const config = getConfig(/websocket/g)[0]

        this.websocket = new Websocket('ws://' + window.location.hostname + ':' + config.port)

        await sleep(250)
    }

    public getWebsocket() {
        return this.websocket
    }

    public send(method: string, data: any = {}) {
        this.websocket.send(JSON.stringify({method: method, data: data}))
    }

    public editColor(color: string|undefined = undefined) {
        this.send('set_color', {color: color})
    }

    public clearEvent(eventUuid: string) {
        this.send('clear_event', {'event-uuid': eventUuid})
    }
}