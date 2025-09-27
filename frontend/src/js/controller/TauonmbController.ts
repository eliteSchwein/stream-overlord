import BaseController from "./BaseController";
import {Websocket} from "websocket-ts";
import {sleep} from "../../../../helper/GeneralHelper";

export default class TauonmbController extends BaseController {
    websocketEndpoints = ['notify_tauonmb_update', 'notify_tauonmb_show']

    protected image = {
        trackId: '',
        small: '',
        medium: ''
    }
    protected currentTrackId = ''
    protected status: any = {}
    protected imageElement = this.element.querySelector('#music-thumbnail') as HTMLImageElement|undefined
    protected barElement = this.element.querySelector('.music-progress-bar') as HTMLDivElement|undefined
    protected titleElement = this.element.querySelector('.music-title-text') as HTMLDivElement|undefined
    protected artistElement = this.element.querySelector('.music-artist-text') as HTMLDivElement|undefined
    protected showTimeout: any = -1

    async handleMessage(websocket: Websocket, method: string, data: any) {
        if(method === 'notify_tauonmb_show') {
            void this.showPlayer()
            return
        }
        if(method !== 'notify_tauonmb_update') return

        if(this.image.trackId === '' && !data.image && !data.status) return

        if(data.image) {
            this.image = data.image
            delete data.image

            if(this.imageElement) this.imageElement.src = this.image.medium
        }

        if(!data.track || !data.track.id) {
            return
        }

        if(this.status.id !== data.id) {
            void this.showPlayer()
        }

        this.status = data

        if(this.barElement) {
            this.barElement.style.width = `${this.status.progress_percentage}%`
        }

        if(this.status.track.id !== this.currentTrackId) {
            if(this.titleElement) {
                this.titleElement.innerHTML = this.status.title
                this.addmarquee(this.titleElement)
            }

            if(this.artistElement) {
                this.artistElement.innerHTML = this.status.artist
                this.addmarquee(this.artistElement)
            }
        }

        this.currentTrackId = this.status.track.id
    }

    private addmarquee(targetElement: HTMLDivElement) {
        const visibleWidth = targetElement.parentElement.clientWidth
        const fullWidth = Math.ceil(targetElement.getBoundingClientRect().width)
        const parentElement = targetElement.parentElement as HTMLDivElement;


        if (fullWidth > visibleWidth) {
            if(!parentElement.classList.contains('marquee')) {
                parentElement.classList.add('marquee');
            }
        } else {
            if(parentElement.classList.contains('marquee')) {
                parentElement.classList.remove('marquee');
            }
        }
    }

    async handleGameUpdate(websocket: Websocket, data: any) {
        if(this.element.hasAttribute("data-disable-theme")) return
        this.barElement.style.background = data.theme.color
        this.titleElement.style.color = data.theme.color
    }

    showPlayer() {
        this.alertBoxHelper.show()
        clearTimeout(this.showTimeout)

        this.showTimeout = setTimeout(()=> {
            this.alertBoxHelper.hide()
        }, 15_000)
    }
}