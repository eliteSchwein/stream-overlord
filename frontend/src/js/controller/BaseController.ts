import {Controller} from "@hotwired/stimulus";
import {getWebsocketClient} from "../../App";
import {Websocket, WebsocketEvents} from "websocket-ts";
import WebsocketClient from "../client/WebsocketClient";
import * as wasi from "node:wasi";

export default class BaseController extends Controller<HTMLElement> {
    websocket: WebsocketClient;
    shieldActive = false;

    async register() {
        this.websocket = getWebsocketClient()

        this.websocket.getWebsocket().addEventListener(WebsocketEvents.message, (websocket, event) => this.handleWebsocket(websocket, event))
    }

    async connect() {
        await this.preConnect()
        await this.register()
        await this.postConnect()
    }

    async preConnect() {

    }

    async postConnect() {

    }

    async handleWebsocket(websocket: Websocket, event: MessageEvent) {
        const data = JSON.parse(event.data)

        if(data.method === 'theme_update') {
            const themeData = data.data.data
            await this.handleTheme(websocket, themeData)

            const themeStyle = document.createElement('style')
            themeStyle.innerHTML = `:root {--theme-color: ${themeData.color}}`
            document.head.appendChild(themeStyle)
            return
        }

        if(data.method === 'shield_mode') {
            this.shieldActive = data.data.status
            await this.handleShield()
        }

        await this.handleMessage(websocket, data.method, data.data)
    }

    async handleShield() {

    }

    async handleTheme(websocket: Websocket, data: any) {

    }

    async handleMessage(websocket: Websocket, method: string, data: any) {

    }
}