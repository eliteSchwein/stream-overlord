import {Controller} from "@hotwired/stimulus";
import {getWebsocketClient} from "../../App";
import {Websocket, WebsocketEvent} from "websocket-ts";
import WebsocketClient from "../client/WebsocketClient";
import AlertBoxHelper from "../helper/AlertBoxHelper";

export default class BaseController extends Controller<HTMLElement> {
    websocket: WebsocketClient;
    shieldActive = false;
    websocketEndpoints: string[] = [];

    alertBoxHelper: AlertBoxHelper

    async register() {
        this.websocket = getWebsocketClient()

        this.websocket.registerEndpoints(this.websocketEndpoints)

        this.websocket.getWebsocket().addEventListener(WebsocketEvent.message, (websocket, event) => this.handleWebsocket(websocket, event))

        this.alertBoxHelper = new AlertBoxHelper(this.element.querySelector('.new-alert-box'))
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

        if(
            data.method === 'notify_game_update'
        ) {
            const gameData = data.params.data
            const themeData = gameData.theme
            await this.handleGameUpdate(websocket, gameData)

            const themeStyle = document.createElement('style')
            themeStyle.innerHTML = `:root {--theme-color: ${themeData.color}}`
            document.head.appendChild(themeStyle)
            return
        }

        if(data.method === 'notify_shield_mode') {
            this.shieldActive = data.params.action === 'enable'
            await this.handleShield()
        }

        await this.handleMessage(websocket, data.method, data.params)
    }

    async handleShield() {

    }

    async handleGameUpdate(websocket: Websocket, data: any) {

    }

    async handleMessage(websocket: Websocket, method: string, data: any) {

    }
}