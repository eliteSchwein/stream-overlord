import BaseController from "./BaseController";
import ParticleHelper from "../helper/ParticleHelper";
import {Websocket} from "websocket-ts";
import {sleep} from "../../../../helper/GeneralHelper";

export default class AlertController extends BaseController {
    websocketEndpoints = ['notify_alert']

    static targets = ['icon', 'content', 'sound', 'video', 'contentContainer', 'logo', 'iframe', 'delayed']

    declare readonly iconTarget: HTMLElement
    declare readonly soundTarget: HTMLAudioElement
    declare readonly contentTargets: HTMLDivElement[]
    declare readonly delayedTargets: HTMLDivElement[]
    declare readonly contentContainerTarget: HTMLDivElement
    declare readonly videoTarget: HTMLVideoElement
    declare readonly logoTarget: HTMLImageElement
    declare readonly iframeTarget: HTMLIFrameElement

    protected channel: string

    async postConnect() {
        this.videoTarget.addEventListener('ended', (event) => this.videoEnd(event))
        this.channel = this.element.getAttribute('data-alert-channel')
    }

    videoEnd(event: Event) {
        this.videoTarget.style.opacity = '0'
        //this.element.querySelector('canvas').style.opacity = '1'
    }

    async handleMessage(websocket: Websocket, method: string, data: any) {
        if(!data.channel || data.channel !== this.channel) return

        if(method !== 'notify_alert') return

        const action = data.action

        switch (action) {
            case 'show': {
                if(data.dummy) return

                if(this.element.style.opacity === "1") return

                this.element.style.opacity = '1'
                this.element.style.height = null
                this.videoTarget.style.opacity = '0'

                if(data.video) {
                    this.videoTarget.style.display = null
                    //this.element.querySelector('canvas').style.opacity = '0'
                    this.element.style.padding = '0 !important'

                    if(!this.element.classList.contains('expand')) {
                        this.element.classList.add('expand')
                    }

                    try {
                        this.videoTarget.muted = true
                        this.videoTarget.querySelector('source').src = data.video
                        this.videoTarget.load()

                        await sleep(50)

                        this.element.style.height = `${this.videoTarget.getBoundingClientRect().height}px`

                        await sleep(50)

                        this.videoTarget.style.opacity = '1'
                        await this.videoTarget.play()
                        if(!data.sound)
                            this.websocket.send('play_sound', {sound: data.video, volume: data.volume})
                    } catch (e) {
                        console.error(e)
                    }
                }
                if(data.sound) {
                    this.videoTarget.style.display = 'none'
                    this.element.style.padding = null

                    this.element.classList.remove('expand')

                    try {
                        this.websocket.send('play_sound', {sound: data.sound, volume: data.volume})
                        //this.soundTarget.querySelector('source').src = data.sound
                        //this.soundTarget.load()
                        //await this.soundTarget.play()
                    } catch (e) {
                        console.error(e)
                    }
                }
                if(data.iframe) {
                    this.element.classList.add('aspect')
                    this.iframeTarget.src = data.iframe
                    setTimeout(() => {
                        this.iframeTarget.classList.remove('d-none')
                    }, 2_000)
                }
                if(data.logo) {
                    this.logoTarget.classList.remove('d-none')
                    this.logoTarget.src = data.logo
                }

                for(const contentElement of this.contentTargets) {
                    contentElement.innerHTML = data.message
                }

                setTimeout(() => {
                    for(const delayedElement of this.delayedTargets) {
                        delayedElement.style.display = null
                    }
                }, 250)

                this.iconTarget.setAttribute('class', `alert-logo mdi mdi-${data.icon}`)
                return
            }
            case 'hide': {
                if(data.dummy) return

                try {
                    this.soundTarget.pause()
                    this.videoTarget.pause()
                } catch (e) {
                    console.error(e)
                }

                this.iframeTarget.src = ''
                this.logoTarget.src = ''

                if(!this.iframeTarget.classList.contains('d-none'))
                    this.iframeTarget.classList.add('d-none')

                if(!this.logoTarget.classList.contains('d-none'))
                    this.logoTarget.classList.add('d-none')

                this.element.classList.remove('expand')
                this.element.classList.remove('aspect')
                this.element.style.height = null

                this.element.style.opacity = '0'

                this.element.style.width = null
                this.element.style.padding = null

                await sleep(500)

                for(const contentElement of this.contentTargets) {
                    contentElement.innerHTML = ''
                }

                for(const delayedElement of this.delayedTargets) {
                    delayedElement.style.display = 'none'
                }

                this.iconTarget.setAttribute('class', `alert-logo mdi`)
                return
            }
        }
    }

    async handleGameUpdate(websocket: Websocket, data: any) {
        if(this.element.hasAttribute("data-disable-theme")) return
        this.iconTarget.style.color = data.theme.color
    }
}