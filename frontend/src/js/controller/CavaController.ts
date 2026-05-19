import BaseController from "./BaseController";
import { Websocket } from "websocket-ts";

export default class CavaController extends BaseController {
    websocketEndpoints = ['notify_music_cava', 'notify_music_update']

    protected bars: HTMLDivElement[] = []
    protected values: number[] = []
    protected smoothedValues: number[] = []

    protected cavaBuffer = ''
    protected expectedBarCount = 0

    protected smoothing = 0.45
    protected falloff = 6

    async connect() {
        super.connect?.()
        this.element.classList.add('cava-controller')
    }

    async handleMessage(websocket: Websocket, method: string, data: any) {
        if (method !== 'notify_music_cava') return

        const frames = this.parseCavaFrames(String(data?.raw ?? ''))

        for (const values of frames) {
            if (!values.length) continue

            if (!this.expectedBarCount) {
                this.expectedBarCount = values.length
                this.ensureBars(values.length)
            }

            if (values.length !== this.expectedBarCount) {
                continue
            }

            this.values = values
            this.smoothValues()
            this.render()
        }
    }

    async handleGameUpdate(websocket: Websocket, data: any) {
        if (this.element.hasAttribute("data-disable-theme")) return

        for (const bar of this.bars) {
            bar.style.background = data.theme.color
        }
    }

    protected parseCavaFrames(raw: string): number[][] {
        if (!raw) return []

        this.cavaBuffer += raw

        const lines = this.cavaBuffer.split(/\r?\n/)
        this.cavaBuffer = lines.pop() ?? ''

        return lines
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .map(line => line
                .split(/[;,\s]+/)
                .map(value => Number(value))
                .filter(value => Number.isFinite(value))
                .map(value => Math.max(0, Math.min(100, value)))
            )
            .filter(values => values.length > 0)
    }

    protected ensureBars(count: number) {
        if (this.bars.length === count) return

        this.element.innerHTML = ''
        this.bars = []
        this.smoothedValues = new Array(count).fill(0)

        for (let i = 0; i < count; i++) {
            const bar = document.createElement('div')
            bar.classList.add('cava-bar')
            this.element.appendChild(bar)
            this.bars.push(bar)
        }
    }

    protected smoothValues() {
        for (let i = 0; i < this.values.length; i++) {
            const target = this.values[i] ?? 0
            const current = this.smoothedValues[i] ?? 0

            if (target > current) {
                this.smoothedValues[i] =
                    current + (target - current) * this.smoothing
            } else {
                this.smoothedValues[i] =
                    Math.max(target, current - this.falloff)
            }
        }
    }

    protected render() {
        for (let i = 0; i < this.bars.length; i++) {
            const value = this.smoothedValues[i] ?? 0
            this.bars[i].style.height = value > 0
                ? `${Math.max(3, value)}%`
                : '0%'
        }
    }
}