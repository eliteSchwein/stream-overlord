import BaseApi from "../../abstracts/BaseApi";
import {editAutoMacroFile} from "../../helper/AutoMacroHelper";

export default class AutoMacroEditApi extends BaseApi {
    restEndpoint = "auto_macro/edit";
    restPost = true;
    websocketMethod = "auto_macro_edit";

    async handle(data: any): Promise<any> {
        try {
            return {
                status: "okay",
                ...editAutoMacroFile(data?.path ?? data?.file ?? data?.name, data?.content ?? ""),
            };
        } catch (error: any) {
            return { error: error?.message ?? "edit failed" };
        }
    }
}
