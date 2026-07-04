import BaseApi from "../../abstracts/BaseApi";
import {deleteRotateSceneFile} from "../../helper/RotateSceneHelper";

export default class RotateSceneDeleteApi extends BaseApi {
    restEndpoint = "rotating_scene/delete";
    restPost = true;
    websocketMethod = "rotating_scene_delete";

    async handle(data: any): Promise<any> {
        try {
            return {
                status: "okay",
                ...deleteRotateSceneFile(data?.path ?? data?.file ?? data?.name),
            };
        } catch (error: any) {
            return {error: error?.message ?? "delete failed"};
        }
    }
}
