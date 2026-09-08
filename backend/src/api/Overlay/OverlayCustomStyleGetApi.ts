import BaseApi from "../../abstracts/BaseApi";
import {getGeneratedFontCss, listFontFiles, readCustomStyle} from "../../helper/OverlayStyleManagementHelper";

export default class OverlayCustomStyleGetApi extends BaseApi {
    restEndpoint = "overlay/custom-style";
    restPost = false;
    websocketMethod = "overlay_custom_style_get";

    async handle(): Promise<any> {
        return {
            ...readCustomStyle(),
            fonts: listFontFiles(),
            generated_font_css: getGeneratedFontCss(),
        };
    }
}
