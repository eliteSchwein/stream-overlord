import BaseApi from "../../abstracts/BaseApi";
import { createMacroFolder } from "../../helper/MacroHelper";

export default class MacroCreateFolderApi extends BaseApi {
    restEndpoint = "macro/create_folder";
    restPost = true;
    websocketMethod = "macro_create_folder";

    async handle(data: any): Promise<any> {
        try {
            return createMacroFolder(data?.path ?? "", data?.name);
        } catch (error: any) {
            return { error: error?.message ?? "create folder failed" };
        }
    }
}
