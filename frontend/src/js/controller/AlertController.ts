import BaseController from "./BaseController";
import ParticleHelper from "../helper/ParticleHelper";
import {Websocket} from "websocket-ts";
import {sleep} from "../../../../helper/GeneralHelper";

export default class AlertController extends BaseController{
    static targets = ['icon', 'content', 'sound', 'video', 'contentContainer']

    declare readonly iconTarget: HTMLElement
    declare readonly soundTarget: HTMLAudioElement
    declare readonly contentTargets: HTMLDivElement[]
    declare readonly contentContainerTarget: HTMLDivElement
    declare readonly videoTarget: HTMLVideoElement

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

                this.websocket.editColor(activeAlert.color)

                if(activeAlert.video) {
                    this.videoTarget.style.display = null
                    this.element.style.padding = '0 !important'

                    if(!this.element.classList.contains('expand')) {
                        this.element.classList.add('expand')
                    }

                    this.videoTarget.querySelector('source').src = activeAlert.video
                    this.videoTarget.load()
                    await this.videoTarget.play()
                    this.particle.destroyParticle()
                } else {
                    this.videoTarget.style.display = 'none'
                    this.element.style.padding = null

                    this.element.classList.remove('expand')

                    this.soundTarget.querySelector('source').src = activeAlert.sound
                    this.soundTarget.load()
                    await this.soundTarget.play()
                }

                for(const contentElement of this.contentTargets) {
                    contentElement.innerHTML = activeAlert.message
                }

                this.iconTarget.setAttribute('class', `alert-logo mdi mdi-${activeAlert.icon}`)

                this.alerts[0] = activeAlert
                return
            }

            this.websocket.clearEvent(activeAlert['event-uuid'])

            this.alerts.shift()

            this.videoTarget.pause()

            this.element.classList.remove('expand')

            this.element.style.opacity = '0'

            this.element.style.width = null
            this.element.style.padding = null

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