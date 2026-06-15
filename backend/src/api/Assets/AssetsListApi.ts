import {getAssetConfigs, getWledConfigs, loadAssetConfigs} from "../../helper/AssetHelper";
import BaseApi from "../../abstracts/BaseApi";

export default class AssetsListApi extends BaseApi {
    restEndpoint = "assets/list";
    restPost = true;
    websocketMethod = "assets_list";

    async handle(): Promise<any> {
        try {
            loadAssetConfigs();

            return {
                assets: getAssetConfigs(),
                wled: getWledConfigs(),
            };
        } catch (error: any) {
            return { error: error?.message ?? "list assets failed" };
        }
    }
}
