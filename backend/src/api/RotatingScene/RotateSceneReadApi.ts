import BaseApi from "../../abstracts/BaseApi";
import {readRotateSceneFile} from "../../helper/RotateSceneHelper";

export default class RotateSceneReadApi extends BaseApi {
    restEndpoint = "rotating_scene/read";
    restPost = true;
    websocketMethod = "rotating_scene_read";

    async handle(data: any): Promise<any> {
        try {
            return {
                status: "okay",
                ...await readRotateSceneFile(data?.path ?? data?.file ?? data?.name),
            };
        } catch (error: any) {
            return {error: error?.message ?? "read failed"};
        }
    }
}
