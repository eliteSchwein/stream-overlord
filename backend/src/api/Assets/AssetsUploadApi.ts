import {addAssetConfigFilesFromUpload} from "../../helper/AssetHelper";
import BaseApi from "../../abstracts/BaseApi";

export default class AssetsUploadApi extends BaseApi {
    restEndpoint = "assets/upload";
    restPost = true;
    websocketMethod = "assets_upload";

    async handle(data: any): Promise<any> {
        try {
            const files = data?.files ?? data?.file ?? [];
            const normalizedFiles = Array.isArray(files) ? files : [files];

            return {
                status: "okay",
                files: await addAssetConfigFilesFromUpload(normalizedFiles, data?.path ?? ""),
            };
        } catch (error: any) {
            return { error: error?.message ?? "upload assets failed" };
        }
    }
}
