import BaseApi from "../../abstracts/BaseApi";
import {listRotateSceneFiles} from "../../helper/RotateSceneHelper";

export default class RotateSceneListApi extends BaseApi {
    restEndpoint = "rotating_scene/list";
    restPost = true;
    websocketMethod = "rotating_scene_list";

    async handle(data: any): Promise<any> {
        try {
            return {
                path: data?.path ?? "",
                files: listRotateSceneFiles(data?.path ?? ""),
            };
        } catch (error: any) {
            return {error: error?.message ?? "list failed"};
        }
    }
}
