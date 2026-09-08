import BaseApi from "../../abstracts/BaseApi";
import {getGeneratedFontCss, listFontFiles} from "../../helper/OverlayStyleManagementHelper";

export default class FontListApi extends BaseApi {
    restEndpoint = "overlay/fonts";
    restPost = false;
    websocketMethod = "overlay_fonts_list";

    async handle(): Promise<any> {
        return {
            files: listFontFiles(),
            generated_css: getGeneratedFontCss(),
        };
    }
}
