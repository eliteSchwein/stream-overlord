import BaseController from "./BaseController";
import ParticleHelper from "../helper/ParticleHelper";
import {Websocket} from "websocket-ts";
import {sleep} from "../../../../helper/GeneralHelper";

export default class AlertController extends BaseController {
    static targets = ['icon', 'content', 'sound', 'video', 'contentContainer']

    declare readonly iconTarget: HTMLElement
    declare readonly soundTarget: HTMLAudioElement
    declare readonly contentTargets: HTMLDivElement[]
    declare readonly contentContainerTarget: HTMLDivElement
    declare readonly videoTarget: HTMLVideoElement

    protected particle: ParticleHelper

    async postConnect() {
        this.particle = new ParticleHelper()
        await this.particle.loadParticle(this.element)
        this.videoTarget.addEventListener('ended', (event) => this.videoEnd(event))
    }

    videoEnd(event: Event) {
        this.videoTarget.style.opacity = '0'
        this.element.querySelector('canvas').style.opacity = '1'
    }

    async handleMessage(websocket: Websocket, method: string, data: any) {
        switch (method) {
            case 'show_alert': {
                if(this.element.style.opacity === "1") return

                this.element.style.opacity = '1'
                this.element.style.height = null
                this.videoTarget.style.opacity = '0'

                if(data.video) {
                    this.videoTarget.style.display = null
                    this.element.querySelector('canvas').style.opacity = '0'
                    this.element.style.padding = '0 !important'

                    if(!this.element.classList.contains('expand')) {
                        this.element.classList.add('expand')
                    }

                    try {
                        this.videoTarget.querySelector('source').src = data.video
                        this.videoTarget.load()

                        await sleep(50)

                        this.element.style.height = `${this.videoTarget.getBoundingClientRect().height}px`

                        await sleep(50)

                        this.videoTarget.style.opacity = '1'
                        await this.videoTarget.play()
                    } catch (e) {
                        console.error(e)
                    }
                } else if(data.sound) {
                    this.videoTarget.style.display = 'none'
                    this.element.style.padding = null

                    this.element.classList.remove('expand')

                    try {
                        this.soundTarget.querySelector('source').src = data.sound
                        this.soundTarget.load()
                        await this.soundTarget.play()
                    } catch (e) {
                        console.error(e)
                    }
                }

                for(const contentElement of this.contentTargets) {
                    contentElement.innerHTML = data.message
                }

                this.iconTarget.setAttribute('class', `alert-logo mdi mdi-${data.icon}`)
                return
            }
            case 'hide_alert': {
                this.soundTarget.pause()
                this.videoTarget.pause()

                this.element.classList.remove('expand')
                this.element.style.height = null

                this.element.style.opacity = '0'

                this.element.style.width = null
                this.element.style.padding = null

                await sleep(500)

                for(const contentElement of this.contentTargets) {
                    contentElement.innerHTML = ''
                }

                this.iconTarget.setAttribute('class', `alert-logo mdi`)
                return
            }
        }
    }

    async handleTheme(websocket: Websocket, data: any) {
        await this.particle.loadThemeColor(data.color)
        this.element.style.boxShadow = `0 0 7px 0 ${data.color}`
        this.iconTarget.style.color = data.color
    }
}