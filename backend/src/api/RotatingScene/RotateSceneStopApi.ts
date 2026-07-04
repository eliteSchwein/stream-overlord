import BaseApi from "../../abstracts/BaseApi";
import {stopRotateScene} from "../../helper/RotateSceneHelper";

export default class RotateSceneStopApi extends BaseApi {
    restEndpoint = "rotating_scene/stop";
    restPost = true;
    websocketMethod = "rotating_scene_stop";

    async handle(): Promise<any> {
        try {
            stopRotateScene();
        } catch (error: any) {
            return { error: error?.message ?? "rotating scene stop failed" };
        }
    }
}
