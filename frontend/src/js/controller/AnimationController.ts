import BaseController from "./BaseController";
import lottie, {AnimationItem} from "lottie-web";

export default class AnimationController extends BaseController {
    private target = this.element.dataset.target ?? "default"
    private src = this.element.dataset.src
    private animation: AnimationItem | null = null

    websocketEndpoints = [
        'notify_animation_update',
    ]

    async postConnect() {
        if (!this.src) return

        this.animation = lottie.loadAnimation({
            container: this.element,
            renderer: "svg",
            loop: false,
            autoplay: false,
            path: this.src,
        })
    }

    async handleMessage(websocket: any, method: string, data: any) {
        if (method !== 'notify_animation_update') return
        if (!this.animation) return
        if (data.target && data.target !== this.target) return

        const startFrame = data.startFrame ?? data.start_frame ?? 0
        const stopFrame = data.stopFrame ?? data.stop_frame ?? this.animation.totalFrames
        const speed = data.speed ?? 1

        this.applyVariables(data.variables ?? {})

        this.animation.loop = data.loop ?? false
        this.animation.setSpeed(speed)
        this.animation.goToAndStop(startFrame, true)
        this.animation.playSegments([startFrame, stopFrame], true)
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