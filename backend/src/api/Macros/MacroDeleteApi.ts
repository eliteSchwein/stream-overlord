import BaseApi from "../../abstracts/BaseApi";
import {deleteMacroFile} from "../../helper/MacroHelper";

export default class MacroDeleteApi extends BaseApi {
    restEndpoint = "macro/delete";
    restPost = true;
    websocketMethod = "macro_delete";

    async handle(data: any): Promise<any> {
        try {
            return {
                status: "okay",
                ...deleteMacroFile(data?.path ?? data?.file ?? data?.name),
            };
        } catch (error: any) {
            return { error: error?.message ?? "delete failed" };
        }
    }
}
