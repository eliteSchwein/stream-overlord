import BaseApi from "../../abstracts/BaseApi";
import {isCustomStylePresent} from "../../helper/OverlayStyleManagementHelper";

export default class OverlayCustomStyleExistsApi extends BaseApi {
    restEndpoint = "overlay/custom-style/exists";
    restPost = true;
    websocketMethod = "overlay_custom_style_exists";

    async handle(data: any): Promise<any> {
        const name = String(data?.name ?? "").trim();

        if (!name) {
            return {error: "custom style file name is required"};
        }

        try {
            return {
                name,
                exists: isCustomStylePresent(name),
            };
        } catch (error: any) {
            return {error: error?.message ?? "custom style exists check failed"};
        }
    }
}
