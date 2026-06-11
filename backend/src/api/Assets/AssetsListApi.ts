import {listAssets} from "../../helper/AssetManagementHelper";
import BaseApi from "../../abstracts/BaseApi";

export default class AssetsListApi extends BaseApi {
    restEndpoint = "assets/list";
    restPost = true;
    websocketMethod = "assets_list";

    async handle(data: any): Promise<any> {
        try {
            return {
                path: data?.path ?? "",
                files: listAssets(data?.path ?? ""),
            };
        } catch (error: any) {
            return { error: error?.message ?? "list failed" };
        }
    }
}
