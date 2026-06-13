import BaseApi from "../../abstracts/BaseApi";
import { readOverlayFile } from "../../helper/OverlayManagementHelper";

export default class OverlayReadApi extends BaseApi {
    restEndpoint = "overlay/read";
    restPost = true;
    websocketMethod = "overlay_read";

    async handle(data: any): Promise<any> {
        try {
            return {
                status: "okay",
                ...readOverlayFile(data?.path),
            };
        } catch (error: any) {
            return { error: error?.message ?? "read failed" };
        }
    }
}