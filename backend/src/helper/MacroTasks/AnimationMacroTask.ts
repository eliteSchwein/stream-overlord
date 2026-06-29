import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {logRegular} from "../LogHelper";

export default class AnimationMacroTask extends BaseMacroTask {
    channel = "animation"

    async handle(method: string, data: any = {}) {
        let startFrame = data.startFrame ?? data.start_frame ?? 0
        let stopFrame = data.stopFrame ?? data.stop_frame ?? null
        const reverse = data.reverse === true || data.reverse === "true"

        if (stopFrame === null || stopFrame === undefined) {
            stopFrame = data.totalFrames ?? data.total_frames ?? null
        }

        if (reverse && stopFrame !== null && startFrame < stopFrame) {
            const originalStartFrame = startFrame
            startFrame = stopFrame
            stopFrame = originalStartFrame
        }

        logRegular(`trigger animation: ${data.target} ${startFrame} -> ${stopFrame} speed: ${data.speed ?? 1} loop: ${data.loop ?? false} ${data.src ?? ''}`)

        this.websocket.send('notify_animation_update', {
            target: data.target,
            src: data.src,
            animation: method,
            startFrame,
            stopFrame,
            speed: data.speed ?? 1,
            loop: data.loop ?? false,
            totalFrames: data.totalFrames ?? data.total_frames,
            frameRate: data.frameRate ?? data.frame_rate,
            variables: data.variables ?? {},
        })
    }
}
