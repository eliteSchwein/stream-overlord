import BaseApi from "../../abstracts/BaseApi";
import {getAssetStorageInfo} from "../../helper/AssetManagementHelper";

export default class AssetsStorageApi extends BaseApi {
    restEndpoint = "assets/storage";
    restPost = true;
    websocketMethod = "assets_storage";

    async handle(): Promise<any> {
        try {
            return getAssetStorageInfo();
        } catch (error: any) {
            return { error: error?.message ?? "storage info failed" };
        }
    }
}
