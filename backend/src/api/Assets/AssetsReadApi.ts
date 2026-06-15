import {readAssetConfigRawFile} from "../../helper/AssetHelper";
import BaseApi from "../../abstracts/BaseApi";

export default class AssetsReadApi extends BaseApi {
    restEndpoint = "assets/read";
    restPost = true;
    websocketMethod = "assets_read";

    async handle(data: any): Promise<any> {
        try {
            return await readAssetConfigRawFile(data?.path ?? data?.name);
        } catch (error: any) {
            return { error: error?.message ?? "read asset failed" };
        }
    }
}
