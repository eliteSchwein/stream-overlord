import BaseController from "./BaseController";
import {Websocket} from "websocket-ts";

export default class BackgroundController extends BaseController {
    protected videoExtensions = ['mp4','webm']
    protected imageExtensions = ['gif','png','jpg','webp']

    async handleTheme(websocket: Websocket, data: any) {
        const background = data.animated_background

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