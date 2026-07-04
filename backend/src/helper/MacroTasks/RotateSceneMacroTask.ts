import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {startRotateScene, stopRotateScene} from "../RotateSceneHelper";

export default class RotateSceneMacroTask extends BaseMacroTask {
    getChannel(): string {
        return "rotate_scene";
    }

    async run(channel: string, method: string, data: any = {}): Promise<any> {
        switch (method) {
            case "start":
                return startRotateScene(data?.name ?? data?.rotateScene ?? data?.rotatingScene);
            case "stop":
                stopRotateScene();
                return true;
            default:
                return false;
        }
    }
}
