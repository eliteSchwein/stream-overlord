import BaseController from "./BaseController";
import ParticleHelper from "../helper/ParticleHelper";
import {Websocket} from "websocket-ts";
import {sleep} from "../../../../helper/GeneralHelper";

export default class AlertController extends BaseController{
    static targets = ['icon', 'content', 'sound']

    declare readonly iconTarget: HTMLElement
    declare readonly soundTarget: HTMLAudioElement
    declare readonly contentTargets: HTMLDivElement[]

    protected alerts = []
    protected particle: ParticleHelper

    async postConnect() {
        this.particle = new ParticleHelper()
        await this.particle.loadParticle(this.element)

        setInterval(async () => {
            if(this.alerts.length === 0) return

            this.element.style.opacity = '1'

            const activeAlert = this.alerts[0]

            if(activeAlert.duration !== 0) {
                activeAlert.duration--

                if(activeAlert.active) {
                    this.alerts[0] = activeAlert
                    return
                }

                activeAlert.active = true

                if(activeAlert.expand === true) {
                    this.iconTarget.style.display = 'none'
                    if(!this.element.classList.contains('expand')) {
                        this.element.classList.add('expand')
                    }
                } else {
                    this.iconTarget.style.display = null
                    this.element.classList.remove('expand')
                }

                this.websocket.editColor(activeAlert.color)

                for(const contentElement of this.contentTargets) {
                    contentElement.innerHTML = activeAlert.message
                }

                this.iconTarget.setAttribute('class', `alert-logo mdi mdi-${activeAlert.icon}`)

                this.soundTarget.querySelector('source').src = activeAlert.sound
                await this.soundTarget.play()

                this.alerts[0] = activeAlert
                return
            }

            this.websocket.clearEvent(activeAlert['event-uuid'])

            this.alerts.shift()

            this.element.classList.remove('expand')

            this.element.style.opacity = '0'

            await sleep(500)

            for(const contentElement of this.contentTargets) {
                contentElement.innerHTML = ''
            }

            this.iconTarget.setAttribute('class', `alert-logo mdi`)

            if(this.alerts.length !== 0) return

            this.iconTarget.style.display = null

            await sleep(500)

            this.websocket.editColor()
        }, 1000)
    }

    async handleMessage(websocket: Websocket, method: string, data: any) {
        if(method !== 'show_alert') return

        this.alerts.push(data)
    }

    async handleTheme(websocket: Websocket, data: any) {
        await this.particle.loadThemeColor(data.color)
        this.element.style.boxShadow = `0 0 7px 0 ${data.color}`
        this.iconTarget.style.color = data.color
    }
}