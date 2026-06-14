import BaseApi from "../../abstracts/BaseApi";
import { editMacroFile } from "../../helper/MacroHelper";

export default class MacroEditApi extends BaseApi {
    restEndpoint = "macro/edit";
    restPost = true;
    websocketMethod = "macro_edit";

    async handle(data: any): Promise<any> {
        try {
            return {
                status: "okay",
                ...editMacroFile(data?.path ?? data?.file ?? data?.name, data?.content ?? ""),
            };
        } catch (error: any) {
            return { error: error?.message ?? "edit failed" };
        }
    }
}
