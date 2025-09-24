import BaseController from "./BaseController";
import {Websocket} from "websocket-ts";
import {sleep} from "../../../../helper/GeneralHelper";
import AlertBoxHelper from "../helper/AlertBoxHelper";

export default class ShoutoutController extends BaseController {
    websocketEndpoints = ['notify_shoutout_clip']

    static targets = ['channelname', 'iframe']

    declare readonly channelnameTargets: HTMLElement[]
    declare readonly iframeTarget: HTMLIFrameElement

    async handleMessage(websocket: Websocket, method: string, data: any) {
        if(method !== 'notify_shoutout_clip') return

        this.element.classList.add('visible')

        this.alertBoxHelper.show()

        if(!this.iframeTarget) return

        this.iframeTarget.style.display = null
        this.iframeTarget.src = this.parseData(data, this.iframeTarget.dataset.src)

        this.channelnameTargets.forEach((element) => {
            element.innerHTML = data.name
        })

        await sleep(20_000)

        if(!this.iframeTarget) return

        this.iframeTarget.src = ''
        this.iframeTarget.style.display = 'none'

        this.alertBoxHelper.hide()

        await sleep(1000)

        this.element.classList.remove('visible')
    }

    private parseData(data: any, input: string): any {
        return input
            .replace('${channel}', data.channel)
            .replace('${channelname}', data.name)
    }
}