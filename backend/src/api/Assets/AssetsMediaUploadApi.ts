import BaseApi from "../../abstracts/BaseApi";
import {addAssetFilesFromUpload} from "../../helper/AssetManagementHelper";

export default class AssetsMediaUploadApi extends BaseApi {
    restEndpoint = "assets/media/upload";
    restPost = true;
    websocketMethod = "assets_media_upload";

    async handle(data: any): Promise<any> {
        try {
            const files = data?.files ?? data?.file ?? [];
            const normalizedFiles = Array.isArray(files) ? files : [files];

            return {
                status: "okay",
                files: await addAssetFilesFromUpload(
                    normalizedFiles,
                    data?.path ?? "",
                ),
            };
        } catch (error: any) {
            return {
                error: error?.message ?? "upload media failed",
            };
        }
    }
}
