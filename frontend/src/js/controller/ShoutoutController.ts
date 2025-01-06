import BaseController from "./BaseController";
import {Websocket} from "websocket-ts";
import {sleep} from "../../../../helper/GeneralHelper";

export default class ShoutoutController extends BaseController {
    private elements = []
    private iframe: HTMLIFrameElement

    async postConnect() {
        await sleep(250)
        const contentElements = this.element.querySelectorAll("*")

        contentElements.forEach((element) => {
            if(!element.innerHTML.includes('${channelname}') &&
                !element.innerHTML.includes('${channel}')) return

            this.elements.push(element)
        })


        const iframe = this.element.querySelector('iframe')

        if(!iframe) return

        this.iframe = iframe
    }

    async handleMessage(websocket: Websocket, method: string, data: any) {
        if(method !== 'shoutout_clip') return

        this.element.classList.add('visible')

        if(!this.iframe) return

        this.iframe.style.display = null
        this.iframe.src = this.parseData(data, this.iframe.dataset.src)

        this.elements.forEach((element) => {
            element.innerHTML = this.parseData(data, element.innerHTML)
        })

        await sleep(20_000)

        const iframe = this.element.querySelector('iframe')

        if(!iframe) return

        iframe.src = ''
        iframe.style.display = 'none'

        this.element.classList.remove('visible')
    }

    private parseData(data: any, input: string): any {
        return input
            .replace('${channel}', data.channel)
            .replace('${channelname}', data.name)
    }
}