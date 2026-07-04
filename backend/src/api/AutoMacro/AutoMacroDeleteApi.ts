import BaseApi from "../../abstracts/BaseApi";
import {deleteAutoMacroFile} from "../../helper/AutoMacroHelper";

export default class AutoMacroDeleteApi extends BaseApi {
    restEndpoint = "auto_macro/delete";
    restPost = true;
    websocketMethod = "auto_macro_delete";

    async handle(data: any): Promise<any> {
        try {
            return {
                status: "okay",
                ...deleteAutoMacroFile(data?.path ?? data?.file ?? data?.name),
            };
        } catch (error: any) {
            return { error: error?.message ?? "delete failed" };
        }
    }
}
