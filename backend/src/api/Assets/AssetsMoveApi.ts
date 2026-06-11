import {moveAsset} from "../../helper/AssetManagementHelper";
import BaseApi from "../../abstracts/BaseApi";

export default class AssetsMoveApi extends BaseApi {
    restEndpoint = "assets/move";
    restPost = true;
    websocketMethod = "assets_move";

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
