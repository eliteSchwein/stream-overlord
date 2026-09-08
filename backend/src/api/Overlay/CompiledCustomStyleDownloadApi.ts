import BaseApi from "../../abstracts/BaseApi";
import {getCompiledCustomCss} from "../../helper/OverlayStyleManagementHelper";

export default class CompiledCustomStyleDownloadApi extends BaseApi {
    restEndpoint = "overlay/custom-style/download-compiled";
    restPost = false;
    websocketMethod = "overlay_custom_style_download_compiled";

    async handle(): Promise<any> {
        try {
            return {
                filename: "custom.css",
                type: "text/css",
                content: await getCompiledCustomCss(),
            };
        } catch (error: any) {
            return {error: error?.message ?? "compiled stylesheet download failed"};
        }
    }
}
