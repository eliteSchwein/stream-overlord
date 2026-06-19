import BaseController from "./BaseController";
import { Websocket } from "websocket-ts";

type MediaElement = HTMLImageElement | HTMLVideoElement | HTMLAudioElement | HTMLIFrameElement

type MediaType = 'image' | 'video' | 'audio' | 'iframe' | 'unknown'

export default class MediaController extends BaseController {
    websocketEndpoints = ['notify_media_update']

    protected target = 'default'
    protected mediaElement?: MediaElement
    protected clearOnEmpty = true
    protected autoplay = true
    protected loop = false
    protected muted = false
    protected controls = false

    async connect() {
        super.connect?.()

        this.target = this.element.getAttribute('data-media-target')?.trim() || 'default'
        this.clearOnEmpty = this.element.getAttribute('data-media-clear-on-empty') !== 'false'
        this.autoplay = this.element.getAttribute('data-media-autoplay') !== 'false'
        this.loop = this.element.getAttribute('data-media-loop') === 'true'
        this.muted = this.element.getAttribute('data-media-muted') === 'true'
        this.controls = this.element.getAttribute('data-media-controls') === 'true'

        this.element.classList.add('media-controller')

        if (this.isMediaElement(this.element)) {
            this.mediaElement = this.element
        } else {
            const child = this.element.querySelector('img, video, audio, iframe')

            if (child && this.isMediaElement(child)) {
                this.mediaElement = child
            }
        }
    }

    async handleMessage(websocket: Websocket, method: string, data: any) {
        if (method !== 'notify_media_update') return

        const frameTarget = String(data?.target ?? 'default').trim() || 'default'

        if (frameTarget !== this.target) return

        const path = String(data?.path ?? data?.src ?? '').trim()

        if (!path) {
            if (this.clearOnEmpty) this.clearMedia()
            return
        }

        this.showMedia(path, data)
    }

    protected showMedia(src: string, data: any = {}) {
        const type = this.detectMediaType(src, data.type)
        const element = this.ensureMediaElement(type)

        if (!element) return

        this.element.classList.remove('media-empty')
        this.element.classList.add('media-active', `media-${type}`)

        for (const className of Array.from(this.element.classList)) {
            if (className.startsWith('media-') && !['media-controller', 'media-active'].includes(className)) {
                this.element.classList.remove(className)
            }
        }

        this.element.classList.add(`media-${type}`)

        element.setAttribute('src', src)

        if (element instanceof HTMLVideoElement || element instanceof HTMLAudioElement) {
            element.autoplay = data.autoplay ?? this.autoplay
            element.loop = data.loop ?? this.loop
            element.muted = data.muted ?? this.muted
            element.controls = data.controls ?? this.controls
            element.load()

            if (element.autoplay) {
                element.play().catch(() => undefined)
            }
        }
    }

    protected clearMedia() {
        if (!this.mediaElement) return

        if (this.mediaElement instanceof HTMLVideoElement || this.mediaElement instanceof HTMLAudioElement) {
            this.mediaElement.pause()
            this.mediaElement.removeAttribute('src')
            this.mediaElement.load()
        } else {
            this.mediaElement.removeAttribute('src')
        }

        this.element.classList.remove('media-active', 'media-image', 'media-video', 'media-audio', 'media-iframe', 'media-unknown')
        this.element.classList.add('media-empty')
    }

    protected ensureMediaElement(type: MediaType): MediaElement | undefined {
        if (this.mediaElement && this.matchesType(this.mediaElement, type)) {
            return this.mediaElement
        }

        if (this.isMediaElement(this.element) && this.matchesType(this.element, type)) {
            this.mediaElement = this.element
            return this.mediaElement
        }

        if (this.isMediaElement(this.element)) {
            return undefined
        }

        this.element.innerHTML = ''
        this.mediaElement = this.createMediaElement(type)

        if (!this.mediaElement) return undefined

        this.element.appendChild(this.mediaElement)

        return this.mediaElement
    }

    protected createMediaElement(type: MediaType): MediaElement | undefined {
        switch (type) {
            case 'image':
                return document.createElement('img')

            case 'video':
                return document.createElement('video')

            case 'audio':
                return document.createElement('audio')

            case 'iframe':
                return document.createElement('iframe')

            default:
                return document.createElement('img')
        }
    }

    protected detectMediaType(src: string, preferredType?: string): MediaType {
        const type = String(preferredType ?? '').toLowerCase()

        if (['image', 'video', 'audio', 'iframe'].includes(type)) {
            return type as MediaType
        }

        if (/\.(jpe?g|png|gif|webp|svg|avif)(\?.*)?$/i.test(src)) return 'image'
        if (/\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i.test(src)) return 'video'
        if (/\.(mp3|wav|opus|oga|m4a|flac)(\?.*)?$/i.test(src)) return 'audio'
        if (/^https?:\/\//i.test(src)) return 'iframe'

        return 'unknown'
    }

    protected isMediaElement(element: Element): element is MediaElement {
        return element instanceof HTMLImageElement
            || element instanceof HTMLVideoElement
            || element instanceof HTMLAudioElement
            || element instanceof HTMLIFrameElement
    }

    protected matchesType(element: Element, type: MediaType) {
        if (type === 'image') return element instanceof HTMLImageElement
        if (type === 'video') return element instanceof HTMLVideoElement
        if (type === 'audio') return element instanceof HTMLAudioElement
        if (type === 'iframe') return element instanceof HTMLIFrameElement

        return this.isMediaElement(element)
    }
}
