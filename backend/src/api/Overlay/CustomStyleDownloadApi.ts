import BaseApi from "../../abstracts/BaseApi";
import {readCustomStyle} from "../../helper/OverlayStyleManagementHelper";

export default class CustomStyleDownloadApi extends BaseApi {
    restEndpoint = "overlay/custom-style/download";
    restPost = false;
    websocketMethod = "overlay_custom_style_download";

    async handle(data: any): Promise<any> {
        try {
            const result = readCustomStyle(data?.path);

            if (!result.file) {
                throw new Error("style file not found");
            }

            return {
                filename: result.file.name,
                type: result.file.mode === "scss" ? "text/x-scss" : "text/css",
                content: result.content,
            };
        } catch (error: any) {
            return {error: error?.message ?? "custom stylesheet download failed"};
        }
    }
}
