import BaseController from "./BaseController";
import {Websocket} from "websocket-ts";

export default class VisibleController extends BaseController {
    protected id = this.element.dataset.id


    async handleMessage(websocket: Websocket, method: string, data: any) {
        if(!data) return
        if(!data.target || data.target !== this.id) return
        if(data.state === undefined) return

        if(method !== 'notify_visible_element') return

        switch (data.state) {
            case true:
                this.element.style.display = null
                break
            case false:
                this.element.style.display = 'none'
                break
        }
    }
}