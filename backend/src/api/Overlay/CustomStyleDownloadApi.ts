import BaseApi from "../../abstracts/BaseApi";
import {
    getCompiledCustomCss,
    readCustomStyle,
} from "../../helper/OverlayStyleManagementHelper";

export default class CustomStyleDownloadApi extends BaseApi {
    restEndpoint = "overlay/custom-style/download";
    restPost = false;
    websocketMethod = "overlay_custom_style_download";

    async handle(): Promise<any> {
        try {
            const style = readCustomStyle();
            const content = style.mode === "scss"
                ? await getCompiledCustomCss()
                : style.content;

            return {
                filename: "custom.css",
                type: "text/css",
                content,
            };
        } catch (error: any) {
            return {error: error?.message ?? "custom stylesheet download failed"};
        }
    }
}
