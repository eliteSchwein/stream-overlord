import BaseController from "./BaseController";
import {Websocket} from "websocket-ts";
import {sleep} from "../../../../helper/GeneralHelper";

export default class ShoutoutController extends BaseController {
    websocketEndpoints = ['notify_shoutout_clip']

    static targets = ['channelname', 'iframe']

    declare readonly channelnameTargets: HTMLElement[]
    declare readonly iframeTarget: HTMLIFrameElement

    async handleMessage(websocket: Websocket, method: string, data: any) {
        if (method !== 'notify_shoutout_clip') return

        this.element.classList.add('visible')

        this.iframeTarget.style.display = ''
        this.iframeTarget.src = data?.url || this.parseData(data, this.iframeTarget.dataset.src || '')

        this.channelnameTargets.forEach((element) => {
            element.textContent = data?.name || data?.channel || ''
        })

        const playbackSeconds = Math.min(
            300,
            Math.max(5, Number(data?.playback_seconds) || 20),
        )

        await sleep(playbackSeconds * 1000)

        this.iframeTarget.src = ''
        this.iframeTarget.style.display = 'none'

        await sleep(1000)
        this.element.classList.remove('visible')
    }

    private parseData(data: any, input: string): string {
        return input
            .replace('${channel}', data?.channel ?? '')
            .replace('${channelname}', data?.name ?? '')
    }
}
