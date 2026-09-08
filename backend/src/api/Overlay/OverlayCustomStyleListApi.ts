import BaseApi from "../../abstracts/BaseApi";
import {
    getGeneratedFontCss,
    listCustomStyles,
    listFontFiles,
} from "../../helper/OverlayStyleManagementHelper";

export default class OverlayCustomStyleListApi extends BaseApi {
    restEndpoint = "overlay/custom-style/list";
    restPost = false;
    websocketMethod = "overlay_custom_style_list";

    async handle(): Promise<any> {
        return {
            files: listCustomStyles(),
            fonts: listFontFiles(),
            generated_font_css: getGeneratedFontCss(),
        };
    }
}
