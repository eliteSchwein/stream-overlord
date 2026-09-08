import BaseApi from "../../abstracts/BaseApi";
import {
    getGeneratedFontCss,
    listCustomStyles,
    listFontFiles,
    readCustomStyle,
} from "../../helper/OverlayStyleManagementHelper";

export default class OverlayCustomStyleGetApi extends BaseApi {
    restEndpoint = "overlay/custom-style";
    restPost = false;
    websocketMethod = "overlay_custom_style_get";

    async handle(data: any): Promise<any> {
        try {
            const result = readCustomStyle(data?.path);

            return {
                ...result,
                files: listCustomStyles(),
                fonts: listFontFiles(),
                generated_font_css: getGeneratedFontCss(),
            };
        } catch (error: any) {
            return {error: error?.message ?? "loading custom style failed"};
        }
    }
}
