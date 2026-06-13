import BaseApi from "../../abstracts/BaseApi";
import { listOverlays } from "../../helper/OverlayManagementHelper";

export default class OverlayListApi extends BaseApi {
    restEndpoint = "overlay/list";
    restPost = true;
    websocketMethod = "overlay_list";

    async handle(data: any): Promise<any> {
        try {
            return {
                path: data?.path ?? "",
                files: listOverlays(data?.path ?? ""),
            };
        } catch (error: any) {
            return { error: error?.message ?? "list failed" };
        }
    }
}