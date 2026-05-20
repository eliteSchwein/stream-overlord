import BaseController from "./BaseController";
import {Websocket} from "websocket-ts";

export default class MusicController extends BaseController {
    websocketEndpoints = ['notify_music_update', 'notify_music_show']

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
    protected volumeElement = this.element.querySelector('.music-volume') as HTMLDivElement|undefined
    protected showTimeout: any = -1
    protected testMode = false

    async handleMessage(websocket: Websocket, method: string, data: any) {
        if(method === 'notify_music_show') {
            void this.showPlayer()
            return
        }
        if(method === 'notify_test_mode') {
            this.testMode = data.active
            this.showPlayer()
            return
        }
        if(method !== 'notify_music_update') return

        if(this.image.trackId === '' && !data.image && !data.status) return

        if(data.image) {
            this.image = data.image
            delete data.image

            if(this.imageElement) this.imageElement.src = this.image.medium
        }

        if(!data.track || !data.track.id) {
            return
        }

        if(this.status.id !== data.id || this.status.volume !== data.volume) {
            void this.showPlayer()
        }

        this.status = data

        this.alertBoxHelper.setTopBarProgress(this.status.progress_percentage)

        if(this.titleElement) {
            this.titleElement.innerHTML = this.status.title
        }

        if(this.artistElement) {
            this.artistElement.innerHTML = this.status.artist
        }

        if(this.volumeElement) {
            const volumeBar = this.volumeElement.querySelector('.music-volume-bar') as HTMLDivElement|undefined
            const volumeText = this.volumeElement.querySelector('.music-volume-text') as HTMLDivElement|undefined

            if(volumeBar) {
                volumeBar.style.width = `${data.volume.toFixed(0)}%`
            }

            if(volumeText) {
                volumeText.innerHTML = `${data.volume.toFixed(0)}%`
            }
        }

        this.currentTrackId = this.status.track.id
    }

    async handleGameUpdate(websocket: Websocket, data: any) {
        if(this.element.hasAttribute("data-disable-theme")) return
        if(this.barElement)
            this.barElement.style.background = data.theme.color

        if(this.titleElement)
            this.titleElement.style.color = data.theme.color
    }

    showPlayer() {
        this.alertBoxHelper.show()
        clearTimeout(this.showTimeout)

        this.showTimeout = setTimeout(()=> {
            if(this.testMode) return
            this.alertBoxHelper.hide()
        }, 15_000)
    }
}