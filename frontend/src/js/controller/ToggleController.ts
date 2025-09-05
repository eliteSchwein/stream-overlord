import BaseController from "./BaseController";
import {Websocket} from "websocket-ts";

export default class ToggleController extends BaseController {
    websocketEndpoints = ['notify_toggle_element']

    protected id = this.element.dataset.id

    async postConnect() {
        if(this.id === "function_attribute") {
            const params = new URLSearchParams(document.location.search)

            if(!params.has("toggle_id")) return

            this.id = params.get("toggle_id")
        }
    }

    async handleMessage(websocket: Websocket, method: string, data: any) {
        if(!data) return
        if(!data.target || data.target !== this.id) return

        if(method !== 'notify_toggle_element') return

        switch (data.action) {
            case 'disable':
                this.element.classList.remove('visible')
                break
            case 'enable':
                if(this.element.classList.contains('visible')) return

                this.element.classList.add('visible')
                break
            default:
                this.element.classList.toggle('visible')
        }
    }
}