import BaseApi from "../../abstracts/BaseApi";
import {listAutoMacroFiles} from "../../helper/AutoMacroHelper";

export default class AutoMacroListApi extends BaseApi {
    restEndpoint = "auto_macro/list";
    restPost = true;
    websocketMethod = "auto_macro_list";

    async handle(data: any): Promise<any> {
        try {
            return {
                path: data?.path ?? "",
                files: listAutoMacroFiles(data?.path ?? ""),
            };
        } catch (error: any) {
            return { error: error?.message ?? "list failed" };
        }
    }
}
