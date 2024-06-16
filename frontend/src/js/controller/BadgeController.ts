import BaseController from "./BaseController";
import ParticleHelper from "../helper/ParticleHelper";
import {Websocket} from "websocket-ts";
import {sleep} from "../../../../helper/GeneralHelper";

export default class BadgeController extends BaseController {
    static targets = ['title', 'subtitle', 'titleImage']

    declare readonly titleTargets: HTMLElement[]
    declare readonly titleImageTarget: HTMLImageElement
    declare readonly subtitleTargets: HTMLElement[]

    protected ads: any
    protected adInterval: any
    protected adIndex = 0
    protected particle: ParticleHelper

    async postConnect() {
        this.websocket.send('get_ads', {})

        this.particle = new ParticleHelper()
        await this.particle.loadParticle(this.element)
    }

    async updateTitle(data: any) {
        for (const titleElement of this.titleTargets) {
            titleElement.style.display = 'none'
        }

        await sleep(50)

        if(data.type === 'text') {
            this.titleImageTarget.src = ''
            this.titleImageTarget.style.display = 'none'

            for (const titleElement of this.titleTargets) {
                titleElement.style.display = null
                titleElement.innerHTML = data.content
            }

            return
        }

        this.titleImageTarget.src = data.url

        await sleep(50)

        this.titleImageTarget.style.display = null
    }

    createInterval() {
        clearInterval(this.adInterval)

        this.adIndex = 0

        this.adInterval = setInterval(() => {
            if(this.adIndex === this.ads.length ) {
                this.adIndex = 0
            }

            this.websocket.send('get_ads', {})

            void this.updateTitle(this.ads[this.adIndex])

            this.adIndex++
        }, 5 * 1000)
    }

    async handleMessage(websocket: Websocket, method: string, data: any) {
        switch (method) {
            case 'ad_result':
                if(JSON.stringify(this.ads) === JSON.stringify(data)) return

                this.ads = data

                this.createInterval()
                break
            case 'toggle_badge':
                this.element.classList.toggle('expand')
                break
        }
    }

    async handleTheme(websocket: Websocket, data: any) {
        await this.particle.loadThemeColor(data.color)
    }
}