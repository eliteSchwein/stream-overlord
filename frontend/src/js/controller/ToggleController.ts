import BaseController from "./BaseController";
import {Websocket} from "websocket-ts";

export default class ToggleController extends BaseController {
    protected id = this.element.dataset.id

    async handleMessage(websocket: Websocket, method: string, data: any) {
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