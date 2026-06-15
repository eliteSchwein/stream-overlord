import {deleteAsset} from "../../helper/AssetManagementHelper";
import BaseApi from "../../abstracts/BaseApi";

export default class MediaDeleteApi extends BaseApi {
    restEndpoint = "assets/media/delete";
    restPost = true;
    websocketMethod = "media_delete";

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
