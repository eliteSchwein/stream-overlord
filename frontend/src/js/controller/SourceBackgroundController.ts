import BaseController from "./BaseController";
import {Websocket} from "websocket-ts";

export default class SourceBackgroundController extends BaseController {
    websocketEndpoints = ['notify_source_update']

    protected videoExtensions = ['mp4','webm']
    protected imageExtensions = ['gif','png','jpg','webp']

    async handleMessage(websocket: Websocket, method: string, data: any) {
        if(method !== 'notify_source_update') {
            return
        }
        const background = data.background

        this.element.innerHTML = ''

        let extension = background.split('.').pop();

        extension = extension.toLowerCase();

        if(this.imageExtensions.includes(extension)) {
            this.element.innerHTML = `<img src="${background}">`;
        }

        if(this.videoExtensions.includes(extension)) {
            this.element.innerHTML = `<video loop muted autoplay><source src="${background}"></video>`;
        }
    }
}