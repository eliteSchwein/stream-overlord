import BaseController from "./BaseController";
import ParticleHelper from "../helper/ParticleHelper";
import {Websocket} from "websocket-ts";
import {sleep} from "../../../../helper/GeneralHelper";

export default class BadgeController extends BaseController {
    static targets = ['title', 'subtitle', 'titleImage', 'logo']

    declare readonly titleTargets: HTMLElement[]
    declare readonly logoTarget: HTMLElement
    declare readonly titleImageTarget: HTMLImageElement
    declare readonly subtitleTargets: HTMLElement[]

    protected ads: any
    protected adInterval: any
    protected adIndex = 0
    //protected particle: ParticleHelper

    async postConnect() {
        this.websocket.send('get_ads', {})

        //this.particle = new ParticleHelper()
        //await this.particle.loadParticle(this.element)
    }

    loadBadgeContent() {
        this.websocket.send('get_ads', {})

        this.logoTarget.style.backgroundImage = null

        void this.updateTitle(this.ads[this.adIndex])
    }

    async handleShield() {
        await sleep(250)
        if(this.shieldActive) {
            await sleep(250)
            this.logoTarget.style.backgroundImage = 'url("/shieldIcon.png")'

            await this.updateTitle({type: "text", content: "eliteSCHW31N"})

            for (const subtitleElement of this.subtitleTargets) {
                subtitleElement.style.display = null
                subtitleElement.innerHTML = "Shield active!"
            }
        } else {
            this.loadBadgeContent()
        }
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

            for (const subtitleElement of this.subtitleTargets) {
                subtitleElement.style.display = null
                subtitleElement.innerHTML = "mehr als ein SCHW31N"
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
            if(this.shieldActive) {
                return
            }

            if(this.adIndex === this.ads.length ) {
                this.adIndex = 0
            }

            this.loadBadgeContent()

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
            //case 'expand_badge':
            //    if(this.element.classList.contains('expand')) break

            //    this.element.classList.add('expand')
            //    break
            //case 'collapse_badge':
            //    this.element.classList.remove('expand')
            //    break
        }
    }

    async handleGameUpdate(websocket: Websocket, data: any) {
        if(!this.element.classList.contains('wall-badge')) return

        const themeData = data.theme

        //this.element.style.borderTop = `3px solid ${data.color}`
        //this.element.style.borderBottom = `3px solid ${data.color}`
        //await this.particle.loadThemeColor(data.color)
        this.element.style.boxShadow = `0 -5px 7px -2px ${themeData.color}, 0 5px 7px -2px ${themeData.color}`;
    }
}