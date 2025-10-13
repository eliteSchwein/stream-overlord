import BaseEvent from "./BaseEvent";
import {getTargetRotateScene, stopRotateScene} from "../../../helper/RotateSceneHelper";

export default class RotatingSceneEvent extends BaseEvent {
    name = 'rotating_scene'
    eventTypes = [
        'CurrentProgramSceneChanged'
    ]

    async handle(data: any) {
        if(data.sceneName === getTargetRotateScene()) return

        stopRotateScene()
    }
}