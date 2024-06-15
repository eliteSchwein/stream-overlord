import {Websocket} from "websocket-ts";
import {getConfig} from "../helper/ConfigHelper";

export default class WebsocketClient {
    websocket: Websocket

    public connect() {
        const config = getConfig(/websocket/g)[0]

        this.websocket = new Websocket('ws://' + window.location.hostname + ':' + config.port);
    }

    public getWebsocket() {
        return this.websocket
    }
}