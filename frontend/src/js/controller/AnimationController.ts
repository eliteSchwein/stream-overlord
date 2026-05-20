import BaseController from "./BaseController";
import {Websocket} from "websocket-ts";
import lottie, {AnimationItem} from "lottie-web";
import "@dotlottie/player-component";

export default class AnimationController extends BaseController {
    private target = this.element.dataset.target ?? "default"
    private src = this.element.dataset.src
    private animation: AnimationItem | null = null
    private dotlottiePlayer: any = null

    websocketEndpoints = [
        "notify_animation_update",
    ]

    async postConnect() {
        if (!this.src) return

        if (this.src.endsWith(".lottie")) {
            this.loadDotLottie()
            return
        }

        this.loadLottieJson()
    }

    private loadLottieJson() {
        this.animation = lottie.loadAnimation({
            container: this.element,
            renderer: "svg",
            loop: false,
            autoplay: false,
            path: this.src,
        })
    }

    private loadDotLottie() {
        this.element.innerHTML = ""

        const player = document.createElement("dotlottie-player") as any

        player.setAttribute("src", this.src)
        player.setAttribute("renderer", "svg")
        player.setAttribute("autoplay", "false")
        player.setAttribute("loop", "false")
        player.style.width = "100%"
        player.style.height = "100%"

        this.element.appendChild(player)

        this.dotlottiePlayer = player
    }

    async handleMessage(websocket: Websocket, method: string, data: any) {
        if (method !== "notify_animation_update") return
        if (data.target && data.target !== this.target) return

        if (this.animation) {
            this.playLottieJson(data)
            return
        }

        if (this.dotlottiePlayer) {
            await this.playDotLottie(data)
        }
    }

    private playLottieJson(data: any) {
        if (!this.animation) return

        const startFrame = data.startFrame ?? data.start_frame ?? 0
        const stopFrame = data.stopFrame ?? data.stop_frame ?? this.animation.totalFrames
        const speed = data.speed ?? 1
        const loop = data.loop ?? false

        this.applyVariables(data.variables ?? {})

        this.animation.loop = loop
        this.animation.setSpeed(speed)
        this.animation.goToAndStop(startFrame, true)
        this.animation.playSegments([startFrame, stopFrame], true)
    }

    private async playDotLottie(data: any) {
        if (!this.dotlottiePlayer) return

        const startFrame = data.startFrame ?? data.start_frame ?? 0
        const speed = data.speed ?? 1

        this.dotlottiePlayer.loop = data.loop ?? false
        this.dotlottiePlayer.speed = speed

        if (typeof this.dotlottiePlayer.seek === "function") {
            this.dotlottiePlayer.seek(startFrame)
        }

        if (typeof this.dotlottiePlayer.play === "function") {
            this.dotlottiePlayer.play()
        }
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