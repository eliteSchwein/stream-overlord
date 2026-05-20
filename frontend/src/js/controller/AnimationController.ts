import BaseController from "./BaseController";
import {Websocket} from "websocket-ts";
import lottie, {AnimationItem} from "lottie-web";
import "@dotlottie/player-component";

export default class AnimationController extends BaseController {
    private targetName = this.element.dataset.target ?? "default"
    private src = this.element.dataset.src
    private animation: AnimationItem | null = null
    private dotlottiePlayer: any = null
    private ready = false
    private queuedData: any = null
    private frameRequest: number | null = null
    private loadId = 0

    websocketEndpoints = [
        "notify_animation_update",
    ]

    async postConnect() {
        if (!this.src) return

        this.reinitAnimation(this.src)
    }

    async handleMessage(websocket: Websocket, method: string, data: any) {
        if (method !== "notify_animation_update") return
        if (data.target && data.target !== this.targetName) return

        if (data.src) {
            this.queuedData = data
            this.element.dataset.src = data.src
            this.reinitAnimation(data.src)
            return
        }

        if (!this.ready) {
            this.queuedData = data
            return
        }

        this.play(data)
    }

    private reinitAnimation(src: string) {
        const currentLoadId = ++this.loadId
        const cleanSrc = src.split("?")[0].split("#")[0].toLowerCase()

        this.destroyCurrentAnimation()

        this.src = src
        this.ready = false
        this.element.dataset.src = src
        this.element.innerHTML = ""

        if (cleanSrc.endsWith(".lottie")) {
            this.loadDotLottie(src, currentLoadId)
            return
        }

        this.loadLottieJson(src, currentLoadId)
    }

    private destroyCurrentAnimation() {
        this.stopFrameLoop()

        if (this.animation) {
            try {
                this.animation.stop()
                this.animation.destroy()
            } catch {}

            this.animation = null
        }

        if (this.dotlottiePlayer) {
            try {
                this.dotlottiePlayer.pause?.()
                this.dotlottiePlayer.stop?.()
                this.dotlottiePlayer.remove()
            } catch {}

            this.dotlottiePlayer = null
        }

        this.ready = false
    }

    private loadLottieJson(src: string, loadId: number) {
        this.animation = lottie.loadAnimation({
            container: this.element,
            renderer: "svg",
            loop: false,
            autoplay: false,
            path: src,
        })

        this.animation.addEventListener("DOMLoaded", () => {
            if (loadId !== this.loadId) return

            this.ready = true
            this.animation?.goToAndStop(0, true)

            this.playQueued()
        })

        this.animation.addEventListener("data_failed", () => {
            if (loadId !== this.loadId) return
            console.warn("lottie json failed to load", src)
        })
    }

    private loadDotLottie(src: string, loadId: number) {
        const player = document.createElement("dotlottie-player") as any

        player.setAttribute("src", src)
        player.setAttribute("renderer", "svg")
        player.removeAttribute("autoplay")
        player.setAttribute("loop", "false")

        player.autoplay = false
        player.loop = false
        player.style.width = "100%"
        player.style.height = "100%"

        const stopInitialPlayback = () => {
            player.pause?.()
            player.stop?.()
            player.seek?.(0)
        }

        player.addEventListener("ready", () => {
            if (loadId !== this.loadId) return

            this.ready = true
            stopInitialPlayback()

            this.playQueued()
        })

        player.addEventListener("load", () => {
            if (loadId !== this.loadId) return
            stopInitialPlayback()
        })

        player.addEventListener("error", (event: any) => {
            if (loadId !== this.loadId) return
            console.warn("dotlottie failed to load", {src, event})
        })

        this.element.appendChild(player)
        this.dotlottiePlayer = player

        requestAnimationFrame(stopInitialPlayback)
        setTimeout(stopInitialPlayback, 0)
        setTimeout(stopInitialPlayback, 50)
    }

    private playQueued() {
        if (!this.queuedData) return

        const queuedData = this.queuedData
        this.queuedData = null
        this.play(queuedData)
    }

    private play(data: any) {
        if (this.animation) {
            this.playLottieJson(data)
            return
        }

        if (this.dotlottiePlayer) {
            this.playDotLottie(data)
            return
        }

        console.warn("animation update received, but no animation instance exists")
    }

    private stopFrameLoop() {
        if (this.frameRequest !== null) {
            cancelAnimationFrame(this.frameRequest)
            this.frameRequest = null
        }
    }

    private resolveFrames(data: any, totalFrames: number) {
        const startFrame = data.startFrame ?? data.start_frame ?? 0
        const stopFrame = data.stopFrame ?? data.stop_frame ?? totalFrames

        return {
            startFrame,
            stopFrame,
            direction: startFrame > stopFrame ? -1 : 1,
        }
    }

    private playLottieJson(data: any) {
        if (!this.animation) return

        this.stopFrameLoop()

        const totalFrames = Math.floor(this.animation.totalFrames)
        const {startFrame, stopFrame, direction} = this.resolveFrames(data, totalFrames)
        const speed = Math.abs(data.speed ?? 1)
        const loop = data.loop ?? false
        const frameRate = (this.animation as any).frameRate ?? 60

        this.applyVariables(data.variables ?? {})

        this.animation.stop()
        this.animation.goToAndStop(startFrame, true)

        let currentFrame = startFrame
        let lastTime = performance.now()

        const tick = (time: number) => {
            if (!this.animation) return

            const delta = time - lastTime
            lastTime = time

            currentFrame += direction * (delta / 1000) * frameRate * speed

            const finished = direction > 0
                ? currentFrame >= stopFrame
                : currentFrame <= stopFrame

            if (finished) {
                if (loop) {
                    currentFrame = startFrame
                } else {
                    this.animation.goToAndStop(stopFrame, true)
                    this.frameRequest = null
                    return
                }
            }

            this.animation.goToAndStop(currentFrame, true)
            this.frameRequest = requestAnimationFrame(tick)
        }

        this.frameRequest = requestAnimationFrame(tick)
    }

    private playDotLottie(data: any) {
        if (!this.dotlottiePlayer) return

        this.stopFrameLoop()

        const totalFrames = data.totalFrames ?? data.total_frames ?? 156
        const {startFrame, stopFrame, direction} = this.resolveFrames(data, totalFrames)
        const speed = Math.abs(data.speed ?? 1)
        const loop = data.loop ?? false
        const frameRate = data.frameRate ?? data.frame_rate ?? 60

        this.dotlottiePlayer.pause?.()
        this.dotlottiePlayer.stop?.()
        this.dotlottiePlayer.seek?.(startFrame)

        let currentFrame = startFrame
        let lastTime = performance.now()

        const tick = (time: number) => {
            if (!this.dotlottiePlayer) return

            const delta = time - lastTime
            lastTime = time

            currentFrame += direction * (delta / 1000) * frameRate * speed

            const finished = direction > 0
                ? currentFrame >= stopFrame
                : currentFrame <= stopFrame

            if (finished) {
                if (loop) {
                    currentFrame = startFrame
                } else {
                    this.dotlottiePlayer.seek?.(stopFrame)
                    this.frameRequest = null
                    return
                }
            }

            this.dotlottiePlayer.seek?.(currentFrame)
            this.frameRequest = requestAnimationFrame(tick)
        }

        this.frameRequest = requestAnimationFrame(tick)
    }

    private applyVariables(variables: any) {
        const svg = this.element.querySelector("svg")
        if (!svg) return

        for (const key in variables) {
            const value = variables[key]

            svg.querySelectorAll(`[data-variable="${key}"], [data-var="${key}"]`)
                .forEach((element) => {
                    element.textContent = String(value)
                })
        }
    }
}