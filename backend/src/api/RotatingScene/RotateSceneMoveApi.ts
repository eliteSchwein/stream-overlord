import BaseApi from "../../abstracts/BaseApi";
import {moveRotateSceneFile} from "../../helper/RotateSceneHelper";

export default class RotateSceneMoveApi extends BaseApi {
    restEndpoint = "rotating_scene/move";
    restPost = true;
    websocketMethod = "rotating_scene_move";

    async handle(data: any): Promise<any> {
        try {
            return {
                status: "okay",
                ...moveRotateSceneFile(data?.source, data?.target),
            };
        } catch (error: any) {
            return {error: error?.message ?? "move failed"};
        }
    }
}
