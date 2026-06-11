import {deleteAsset} from "../../helper/AssetManagementHelper";
import BaseApi from "../../abstracts/BaseApi";

export default class AssetsDeleteApi extends BaseApi {
    restEndpoint = "assets/delete";
    restPost = true;
    websocketMethod = "assets_delete";

    async handle(data: any): Promise<any> {
        try {
            return {
                status: "okay",
                ...deleteAsset(data?.path),
            };
        } catch (error: any) {
            return { error: error?.message ?? "delete failed" };
        }
    }
}
