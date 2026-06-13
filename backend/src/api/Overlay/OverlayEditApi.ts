import BaseApi from "../../abstracts/BaseApi";
import { editOverlayFile } from "../../helper/OverlayManagementHelper";

export default class OverlayEditApi extends BaseApi {
    restEndpoint = "overlay/edit";
    restPost = true;
    websocketMethod = "overlay_edit";

    async handle(data: any): Promise<any> {
        try {
            return {
                status: "okay",
                ...editOverlayFile(data?.path, data?.content ?? ""),
            };
        } catch (error: any) {
            return { error: error?.message ?? "edit failed" };
        }
    }
}