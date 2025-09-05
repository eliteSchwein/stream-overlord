import BaseController from "./BaseController";
import {Websocket} from "websocket-ts";
import BluescreenEffect from "../effects/BluescreenEffect";

export default class EffectController extends BaseController {
    websocketEndpoints = ['notify_effect']

    protected effectMap = {
        'effect': new BluescreenEffect()
    }

    async postConnect() {
        this.websocket.send('get_effect', {})
    }

    async handleMessage(websocket: Websocket, method: string, data: any) {
        if(method !== 'notify_effect') {
            return
        }

        if(data.action !== 'show') {
            this.element.innerHTML = ``
            return
        }

        if(!data.effect && !this.effectMap[data.effect]) {
            return
        }

        this.element.innerHTML = this.effectMap[data.effect].getContent()
    }
}