import BaseController from "./BaseController";
import {Websocket} from "websocket-ts";

export default class ToggleController extends BaseController {
    protected id = this.element.dataset.id

    async handleMessage(websocket: Websocket, method: string, data: any) {
        if(!data.target || data.target !== this.id) return

        switch (method) {
            case 'toggle_element':
                this.element.classList.toggle('visible')
                break
            case 'enable_toggle_element':
                if(this.element.classList.contains('visible')) return

                this.element.classList.add('visible')
                break
            case 'disable_toggle_element':
                this.element.classList.remove('visible')
                break
        }
    }
}