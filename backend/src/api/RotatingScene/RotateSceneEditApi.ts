import BaseApi from "../../abstracts/BaseApi";
import {editRotateSceneFile} from "../../helper/RotateSceneHelper";

export default class RotateSceneEditApi extends BaseApi {
    restEndpoint = "rotating_scene/edit";
    restPost = true;
    websocketMethod = "rotating_scene_edit";

    async handle(data: any): Promise<any> {
        try {
            return {
                status: "okay",
                ...editRotateSceneFile(data?.path ?? data?.file ?? data?.name, data?.content ?? ""),
            };
        } catch (error: any) {
            return {error: error?.message ?? "edit failed"};
        }
    }
}
