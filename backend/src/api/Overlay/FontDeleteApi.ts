import BaseApi from "../../abstracts/BaseApi";
import {deleteFont, getGeneratedFontCss, listFontFiles} from "../../helper/OverlayStyleManagementHelper";

export default class FontDeleteApi extends BaseApi {
    restEndpoint = "overlay/fonts/delete";
    restPost = false;
    websocketMethod = "overlay_fonts_delete";

    async handle(data: any): Promise<any> {
        try {
            deleteFont(String(data?.path ?? ""));

            return {
                status: "okay",
                files: listFontFiles(),
                generated_css: getGeneratedFontCss(),
            };
        } catch (error: any) {
            return {error: error?.message ?? "font delete failed"};
        }
    }
}
