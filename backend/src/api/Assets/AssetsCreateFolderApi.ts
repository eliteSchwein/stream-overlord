import {createAssetFolder} from "../../helper/AssetManagementHelper";
import BaseApi from "../../abstracts/BaseApi";

export default class AssetsCreateFolderApi extends BaseApi {
    restEndpoint = "assets/create_folder";
    restPost = true;
    websocketMethod = "assets_create_folder";

    async handle(data: any): Promise<any> {
        try {
            return createAssetFolder(data?.path ?? "", data?.name);
        } catch (error: any) {
            return { error: error?.message ?? "create folder failed" };
        }
    }
}
