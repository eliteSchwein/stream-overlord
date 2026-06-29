import BaseApi from "../../abstracts/BaseApi";
import {createOverlayFolder} from "../../helper/OverlayManagementHelper";

export default class OverlayCreateFolderApi extends BaseApi {
    restEndpoint = "overlay/create_folder";
    restPost = true;
    websocketMethod = "overlay_create_folder";

    async handle(data: any): Promise<any> {
        try {
            return createOverlayFolder(data?.path ?? "", data?.name);
        } catch (error: any) {
            return { error: error?.message ?? "create folder failed" };
        }
    }
}