import BaseController from "./BaseController";
import {Websocket} from "websocket-ts";

export default class MusicController extends BaseController {
    websocketEndpoints = ['notify_music_update', 'notify_music_show', 'notify_test_mode']

    protected image = {
        trackId: '',
        small: '',
        medium: ''
    }

    protected currentTrackId = ''
    protected status: any = {}
    protected track: any = {}

    protected imageElement = this.element.querySelector('[data-music-element="thumbnail"]') as HTMLImageElement | null
    protected barElement = this.element.querySelector('[data-music-element="progress-bar"]') as HTMLElement | null
    protected titleElement = this.element.querySelector('[data-music-element="title"]') as HTMLElement | null
    protected artistElement = this.element.querySelector('[data-music-element="artist"]') as HTMLElement | null
    protected volumeElement = this.element.querySelector('[data-music-element="volume"]') as HTMLElement | null

    protected showTimeout: any = -1
    protected testMode = false

    async handleMessage(websocket: Websocket, method: string, data: any) {
        if (method === 'notify_music_show') {
            void this.showPlayer()
            return
        }

        if (method === 'notify_test_mode') {
            console.log("[music] test mode update", data)

            this.testMode = data.active
            void this.showPlayer()
            return
        }

        if (method !== 'notify_music_update') {
            return
        }

        if (data.thumbnail) {
            this.image = data.thumbnail

            if (this.imageElement && this.image) {
                this.imageElement.src = this.image.data_url
            }
        }

        if (data.status) {
            this.status = data.status
        }

        if (data.track) {
            this.track = data.track
        }

        if (!this.track) {
            return
        }

        const volume = this.status.volume ?? data.volume ?? 0
        const progress = this.status.progress_percentage
            ?? data.progress_percentage
            ?? 0

        this.alertBoxHelper.setTopBarProgress(progress)

        if (this.titleElement) {
            this.titleElement.textContent = this.track.title ?? this.track.name ?? ''
        }

        if (this.artistElement) {
            this.artistElement.textContent = this.track.artist ?? this.track.artists?.join(', ') ?? ''
        }

        if (this.volumeElement) {
            const volumeBar = this.volumeElement.querySelector('.music-volume-bar') as HTMLDivElement | null
            const volumeText = this.volumeElement.querySelector('.music-volume-text') as HTMLDivElement | null

            if (volumeBar) {
                volumeBar.style.width = `${volume.toFixed(0)}%`
            }

            if (volumeText) {
                volumeText.textContent = `${volume.toFixed(0)}%`
            }
        }

        this.currentTrackId = this.track.id
    }

    async handleGameUpdate(websocket: Websocket, data: any) {
        if (this.element.hasAttribute("data-disable-theme")) return

        if (this.barElement) {
            this.barElement.style.background = data.theme.color
        }

        if (this.titleElement) {
            this.titleElement.style.color = data.theme.color
        }
    }

    showPlayer() {
        this.alertBoxHelper.show()
        clearTimeout(this.showTimeout)

        this.showTimeout = setTimeout(() => {
            if (this.testMode) return
            this.alertBoxHelper.hide()
        }, 15_000)
    }
}