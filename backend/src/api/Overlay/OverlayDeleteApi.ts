import BaseApi from "../../abstracts/BaseApi";
import {deleteOverlay} from "../../helper/OverlayManagementHelper";

export default class OverlayDeleteApi extends BaseApi {
    restEndpoint = "overlay/delete";
    restPost = true;
    websocketMethod = "overlay_delete";

    async handle(data: any): Promise<any> {
        try {
            return {
                status: "okay",
                ...deleteOverlay(data?.path),
            };
        } catch (error: any) {
            return { error: error?.message ?? "delete failed" };
        }
    }
}