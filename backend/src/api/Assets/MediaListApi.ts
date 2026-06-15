import {listAssets} from "../../helper/AssetManagementHelper";
import BaseApi from "../../abstracts/BaseApi";

export default class MediaListApi extends BaseApi {
    restEndpoint = "assets/media/list";
    restPost = true;
    websocketMethod = "media_list";

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
