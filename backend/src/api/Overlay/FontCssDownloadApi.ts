import BaseApi from "../../abstracts/BaseApi";
import {getGeneratedFontCss} from "../../helper/OverlayStyleManagementHelper";

export default class FontCssDownloadApi extends BaseApi {
    restEndpoint = "overlay/fonts/download";
    restPost = false;
    websocketMethod = "overlay_fonts_download";

    async handle(): Promise<any> {
        try {
            return {
                filename: "fonts.css",
                type: "text/css",
                content: getGeneratedFontCss(),
            };
        } catch (error: any) {
            return {error: error?.message ?? "font stylesheet download failed"};
        }
    }
}
