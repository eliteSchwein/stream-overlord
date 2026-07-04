import BaseApi from "../../abstracts/BaseApi";
import {
    getRotateSceneRuntimeState,
    getRotateScenes,
    startRotateScene,
    stopRotateScene
} from "../../helper/RotateSceneHelper";

export default class RotateSceneRuntimeApi extends BaseApi {
    restEndpoint = "rotating_scene/runtime";
    restPost = true;
    websocketMethod = "rotating_scene_runtime";

    async handle(data: any): Promise<any> {
        try {
            const method = data?.method ?? data?.action ?? "state";

            if (method === "start") {
                return {
                    status: await startRotateScene(data?.name),
                    runtime: getRotateSceneRuntimeState(),
                };
            }

            if (method === "stop") {
                stopRotateScene();
                return {
                    status: "okay",
                    runtime: getRotateSceneRuntimeState(),
                };
            }

            return {
                status: "okay",
                runtime: getRotateSceneRuntimeState(),
                rotatingScenes: getRotateScenes(),
            };
        } catch (error: any) {
            return {error: error?.message ?? "runtime failed"};
        }
    }
}
