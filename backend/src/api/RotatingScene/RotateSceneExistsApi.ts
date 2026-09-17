import BaseApi from "../../abstracts/BaseApi";
import {isRotateScenePresent} from "../../helper/RotateSceneHelper";

export default class RotateSceneExistsApi extends BaseApi {
    restEndpoint = "rotating_scene/exists";
    restPost = true;
    websocketMethod = "rotating_scene_exists";

    async handle(data: any): Promise<any> {
        const name = String(data?.name ?? "").trim();

        if (!name) {
            return {error: "rotating scene name is required"};
        }

        return {
            name,
            exists: isRotateScenePresent(name),
        };
    }
}
