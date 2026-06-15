import {deleteAssetConfigFile} from "../../helper/AssetHelper";
import BaseApi from "../../abstracts/BaseApi";

export default class AssetsDeleteApi extends BaseApi {
    restEndpoint = "assets/delete";
    restPost = true;
    websocketMethod = "assets_delete";

    async handle(data: any): Promise<any> {
        try {
            return {
                status: "okay",
                ...await deleteAssetConfigFile(data?.path ?? data?.name),
            };
        } catch (error: any) {
            return { error: error?.message ?? "delete asset failed" };
        }
    }
}
