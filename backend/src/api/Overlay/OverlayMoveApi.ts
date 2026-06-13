import BaseApi from "../../abstracts/BaseApi";
import { moveOverlay } from "../../helper/OverlayManagementHelper";

export default class OverlayMoveApi extends BaseApi {
    restEndpoint = "overlay/move";
    restPost = true;
    websocketMethod = "overlay_move";

    async handle(data: any): Promise<any> {
        try {
            return {
                status: "okay",
                ...moveOverlay(data?.source, data?.target),
            };
        } catch (error: any) {
            return { error: error?.message ?? "move failed" };
        }
    }
}