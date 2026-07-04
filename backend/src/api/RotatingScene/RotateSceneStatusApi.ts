import BaseApi from "../../abstracts/BaseApi";
import {getRotateSceneRuntimeState} from "../../helper/RotateSceneHelper";

export default class RotateSceneStatusApi extends BaseApi {
    restEndpoint = "rotating_scene/status";
    restPost = true;
    websocketMethod = "rotating_scene_status";

    async handle(): Promise<any> {
        try {
            return {
                status: "okay",
                data: getRotateSceneRuntimeState(),
            };
        } catch (error: any) {
            return {
                error: true,
                message: error?.message ?? "rotating scene status failed",
            };
        }
    }
}