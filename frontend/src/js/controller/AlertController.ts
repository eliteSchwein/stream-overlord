import BaseController from './BaseController'
import { Websocket } from 'websocket-ts'
import { sleep } from '../../../../helper/GeneralHelper'

export default class AlertController extends BaseController {
    websocketEndpoints = ['notify_alert']

    static targets = ['element']

    declare readonly elementTargets: HTMLElement[]

    iconTarget: HTMLElement | null = null
    contentTargets: HTMLDivElement[] = []
    delayedTargets: HTMLDivElement[] = []
    contentContainerTarget: HTMLDivElement | null = null
    videoTarget: HTMLVideoElement | null = null
    logoTarget: HTMLImageElement | null = null
    imageTarget: HTMLImageElement | null = null
    iframeTarget: HTMLIFrameElement | null = null

    protected channel: string | null = ''
    protected visible = false

    async postConnect() {
        for (const element of this.elementTargets) {
            if (!element.dataset.alertElementType) continue

            switch (element.dataset.alertElementType) {
                case 'icon':
                    this.iconTarget = element
                    break
                case 'content':
                    this.contentTargets.push(element as HTMLDivElement)
                    break
                case 'delayed':
                    this.delayedTargets.push(element as HTMLDivElement)
                    break
                case 'content-container':
                    this.contentContainerTarget = element as HTMLDivElement
                    break
                case 'video':
                    this.videoTarget = element as HTMLVideoElement
                    break
                case 'logo':
                    this.logoTarget = element as HTMLImageElement
                    break
                case 'image':
                    this.imageTarget = element as HTMLImageElement
                    break
                case 'iframe':
                    this.iframeTarget = element as HTMLIFrameElement
                    break
            }
        }

        this.videoTarget?.addEventListener('ended', event => this.videoEnd(event))
        this.channel = this.element.getAttribute('data-alert-channel')
    }

    videoEnd(event: Event) {
        if (this.videoTarget) {
            this.videoTarget.style.opacity = '0'
        }
    }

    async handleMessage(websocket: Websocket, method: string, data: any) {
        if (method === 'notify_test_mode') {
            data.channel = this.channel
            data.action = data.active ? 'show' : 'hide'
            data.message = 'TEST TEST TEST TEST'
            data.icon = 'test-tube'
        }

        if (!data.channel || data.channel !== this.channel) return
        if (method !== 'notify_alert' && method !== 'notify_test_mode') return

        switch (data.action) {
            case 'show':
                await this.showAlert(data)
                return

            case 'hide':
                await this.hideAlert(data)
                return
        }
    }

    protected async showAlert(data: any): Promise<void> {
        if (data.dummy) return
        if (this.visible) return

        this.visible = true

        this.element.style.height = null
        this.element.style.width = null
        this.element.style.padding = null

        if (this.videoTarget) {
            this.videoTarget.style.opacity = '0'
        }

        if (data.video && this.videoTarget) {
            this.videoTarget.style.display = null

            try {
                this.videoTarget.muted = true
                this.videoTarget.querySelector('source')!.src = data.video
                this.videoTarget.load()

                await sleep(50)

                this.element.style.height = `${this.videoTarget.getBoundingClientRect().height}px`

                await sleep(50)

                this.videoTarget.style.opacity = '1'
                await this.videoTarget.play()

                if (!data.sound) {
                    this.websocket.send('play_sound', {
                        sound: data.video,
                        volume: data.volume,
                    })
                }
            } catch (e) {
                console.error(e)
            }
        }

        if (data.sound) {
            if (this.videoTarget) {
                this.videoTarget.style.display = 'none'
            }

            try {
                this.websocket.send('play_sound', {
                    sound: data.sound,
                    volume: data.volume,
                })
            } catch (e) {
                console.error(e)
            }
        }

        if (data.iframe && this.iframeTarget) {
            this.element.classList.add('aspect')
            this.iframeTarget.src = data.iframe

            setTimeout(() => {
                this.iframeTarget?.classList.remove('d-none')
            }, 2_000)
        }

        if (data.image && this.imageTarget) {
            this.imageTarget.classList.remove('d-none')
            this.imageTarget.src = `/compressed/${data.image}.webp`
        }

        if (data.logo && this.logoTarget) {
            this.logoTarget.classList.remove('d-none')
            this.logoTarget.src = data.logo
        }

        for (const contentElement of this.contentTargets) {
            contentElement.innerHTML = data.message
        }

        setTimeout(() => {
            for (const delayedElement of this.delayedTargets) {
                delayedElement.style.display = null
            }
        }, 250)

        this.iconTarget?.setAttribute('class', `alert-logo mdi mdi-${data.icon}`)
    }

    protected async hideAlert(data: any): Promise<void> {
        if (data.dummy) return

        try {
            this.videoTarget?.pause()
        } catch (e) {
            console.error(e)
        }

        if (this.iframeTarget) {
            this.iframeTarget.src = ''
            this.iframeTarget.classList.add('d-none')
        }

        if (this.logoTarget) {
            this.logoTarget.src = ''
            this.logoTarget.classList.add('d-none')
        }

        if (this.imageTarget) {
            this.imageTarget.classList.add('d-none')
        }

        this.element.classList.remove('expand')
        this.element.classList.remove('aspect')
        this.element.style.height = null
        this.element.style.width = null
        this.element.style.padding = null

        await sleep(500)

        for (const contentElement of this.contentTargets) {
            contentElement.innerHTML = ''
        }

        for (const delayedElement of this.delayedTargets) {
            delayedElement.style.display = 'none'
        }

        this.iconTarget?.setAttribute('class', 'alert-logo mdi')
        this.visible = false
    }

    async handleGameUpdate(websocket: Websocket, data: any) {
        if (this.element.hasAttribute('data-disable-theme')) return

        if (this.iconTarget) {
            this.iconTarget.style.color = data.theme.color
        }
    }
}
