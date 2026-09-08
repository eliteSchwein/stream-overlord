import BaseApi from "../../abstracts/BaseApi";
import {getGeneratedFontCss, listFontFiles, saveCustomStyle} from "../../helper/OverlayStyleManagementHelper";

export default class OverlayCustomStyleSaveApi extends BaseApi {
    restEndpoint = "overlay/custom-style/save";
    restPost = false;
    websocketMethod = "overlay_custom_style_save";

    async handle(data: any): Promise<any> {
        try {
            const result = await saveCustomStyle(
                String(data?.content ?? ""),
                data?.mode === "scss" ? "scss" : "css",
            );

            return {
                status: "okay",
                ...result,
                fonts: listFontFiles(),
                generated_font_css: getGeneratedFontCss(),
            };
        } catch (error: any) {
            return {error: error?.message ?? "failed to save custom style"};
        }
    }
}
