import {compressAsset} from "../../helper/AssetManagementHelper";
import BaseApi from "../../abstracts/BaseApi";


export default class MediaCompressApi extends BaseApi {
    restEndpoint = "assets/media/compress";
    restPost = true;
    websocketMethod = "media_compress";

    async handle(data: any): Promise<any> {
        try {
            return {
                status: "okay",
                ...(await compressAsset(data?.path)),
            };
        } catch (error: any) {
            return { error: error?.message ?? "compress failed" };
        }
    }
}
