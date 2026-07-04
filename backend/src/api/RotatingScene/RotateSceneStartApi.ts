import BaseApi from "../../abstracts/BaseApi";
import {startRotateScene} from "../../helper/RotateSceneHelper";

export default class RotateSceneStartApi extends BaseApi {
    restEndpoint = "rotating_scene/start";
    restPost = true;
    websocketMethod = "rotating_scene_start";

    async handle(data: any): Promise<any> {
        try {
            const name = data?.name ?? data?.scene ?? data?.rotate_scene;
            const started = await startRotateScene(name);

            return {
                status: started ? "okay" : "failed",
                started
            };
        } catch (error: any) {
            return { error: error?.message ?? "rotating scene start failed" };
        }
    }
}
