import BaseController from "./BaseController";
import {Websocket} from "websocket-ts";

export default class TauonmbController extends BaseController {
    websocketEndpoints = ['notify_tauonmb_update']

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

    async handleMessage(websocket: Websocket, method: string, data: any) {
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

        this.status = data

        if(this.status.status === 'playing' && this.imageElement && !this.imageElement.classList.contains("spin")) {
            this.imageElement.classList.add("spin")
        } else if(this.status.status !== 'playing' && this.imageElement && this.imageElement.classList.contains("spin")) {
            this.imageElement.classList.remove("spin")
        }

        if(this.barElement) {
            this.barElement.style.width = `${this.status.progress_percentage}%`
        }

        if(this.titleElement && this.status.track.id !== this.currentTrackId) {
            this.titleElement.innerHTML = this.status.title
            const visibleWidth = this.titleElement.parentElement.clientWidth;
            const fullWidth = this.titleElement.scrollWidth;
            const titleContainerElement = this.titleElement.parentElement as HTMLDivElement;

            if (fullWidth > visibleWidth) {
                if(titleContainerElement.classList.contains('marquee')) {
                    return
                }
                titleContainerElement.classList.add('marquee');
            } else {
                if(!titleContainerElement.classList.contains('marquee')) {
                    return
                }
                titleContainerElement.classList.remove('marquee');
            }
        }

        this.currentTrackId = this.status.track.id
    }

    async handleGameUpdate(websocket: Websocket, data: any) {
        if(this.element.hasAttribute("data-disable-theme")) return
        this.barElement.style.background = data.theme.color
        this.titleElement.style.color = data.theme.color
    }
}