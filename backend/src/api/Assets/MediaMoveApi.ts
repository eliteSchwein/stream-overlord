import {moveAsset} from "../../helper/AssetManagementHelper";
import BaseApi from "../../abstracts/BaseApi";

export default class MediaMoveApi extends BaseApi {
    restEndpoint = "assets/media/move";
    restPost = true;
    websocketMethod = "media_move";

    async handle(data: any): Promise<any> {
        try {
            return {
                status: "okay",
                ...moveAsset(data?.source, data?.target),
            };
        } catch (error: any) {
            return { error: error?.message ?? "move failed" };
        }
    }
}
