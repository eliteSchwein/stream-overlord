import BaseApi from "../../abstracts/BaseApi";
import {deleteCompressedAsset} from "../../helper/AssetManagementHelper";

export default class MediaDeleteCompressedApi extends BaseApi {
    restEndpoint = "assets/media/delete-compressed";
    restPost = true;
    websocketMethod = "media_delete_compressed";

    async handle(data: any): Promise<any> {
        try {
            return {
                status: "okay",
                ...deleteCompressedAsset(data?.path),
            };
        } catch (error: any) {
            return {error: error?.message ?? "delete compressed failed"};
        }
    }
}
