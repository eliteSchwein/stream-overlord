import BaseApi from "../../abstracts/BaseApi";
import {
    deleteCustomStyle,
    getGeneratedFontCss,
} from "../../helper/OverlayStyleManagementHelper";

export default class OverlayCustomStyleDeleteApi extends BaseApi {
    restEndpoint = "overlay/custom-style/delete";
    restPost = false;
    websocketMethod = "overlay_custom_style_delete";

    async handle(data: any): Promise<any> {
        try {
            return {
                ...deleteCustomStyle(String(data?.path ?? "")),
                generated_font_css: getGeneratedFontCss(),
            };
        } catch (error: any) {
            return {error: error?.message ?? "failed to delete custom style"};
        }
    }
}
