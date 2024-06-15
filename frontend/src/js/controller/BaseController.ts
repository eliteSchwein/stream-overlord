import {Controller} from "@hotwired/stimulus";
import {getWebsocketClient} from "../../App";
import {Websocket, WebsocketEvents} from "websocket-ts";

export default class BaseController extends Controller<HTMLElement> {
    async register() {
        const websocket = getWebsocketClient().getWebsocket()

        websocket.addEventListener(WebsocketEvents.message, (websocket, event) => this.handleWebsocket(websocket, event))
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

        await this.handleMessage(websocket, data)
    }

    async handleTheme(websocket: Websocket, data: any) {

    }

    async handleMessage(websocket: Websocket, data: any) {

    }
}