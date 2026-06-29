import BaseApi from "../../abstracts/BaseApi";
import {listMacroFiles} from "../../helper/MacroHelper";

export default class MacroListApi extends BaseApi {
    restEndpoint = "macro/list";
    restPost = true;
    websocketMethod = "macro_list";

    async handle(data: any): Promise<any> {
        try {
            return {
                path: data?.path ?? "",
                files: listMacroFiles(data?.path ?? ""),
            };
        } catch (error: any) {
            return { error: error?.message ?? "list failed" };
        }
    }
}
