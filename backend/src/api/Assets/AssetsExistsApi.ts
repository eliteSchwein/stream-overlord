import BaseApi from "../../abstracts/BaseApi";
import {isAssetConfigPresent} from "../../helper/AssetHelper";

export default class AssetsExistsApi extends BaseApi {
    restEndpoint = "assets/exists";
    restPost = true;
    websocketMethod = "assets_exists";

    async handle(data: any): Promise<any> {
        const name = String(data?.name ?? "").trim();

        if (!name) {
            return {error: "asset name is required"};
        }

        return {
            name,
            exists: isAssetConfigPresent(name),
        };
    }
}
