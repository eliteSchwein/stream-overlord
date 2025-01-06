import BaseController from "./BaseController";
import {Websocket} from "websocket-ts";
import {sleep} from "../../../../helper/GeneralHelper";

export default class ShoutoutController extends BaseController {
    private elements = []

    async postConnect() {
        await sleep(250)
        const contentElements = this.element.querySelectorAll("*")

        contentElements.forEach((element) => {
            if(!element.innerHTML.includes('${channelname}') &&
                !element.innerHTML.includes('${channel}')) return

            this.elements.push(element)
        })
    }

    async handleMessage(websocket: Websocket, method: string, data: any) {
        if(method !== 'shoutout_clip') return

        this.element.classList.add('visible')

        const iframe = this.element.querySelector('iframe')

        if(!iframe) return

        iframe.src = this.parseData(data, iframe.dataset.src)

        this.elements.forEach((element) => {
            element.innerHTML = this.parseData(data, element.innerHTML)
        })

        setTimeout(async () => {
            iframe.src = ''

            this.element.classList.remove('visible')
        }, 15_000)
    }

    private parseData(data: any, input: string): any {
        return input
            .replace('${channel}', data.channel)
            .replace('${channelname}', data.name)
    }
}