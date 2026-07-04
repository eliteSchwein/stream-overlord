import BaseApi from "../../abstracts/BaseApi";
import {readAutoMacroFile} from "../../helper/AutoMacroHelper";

export default class AutoMacroReadApi extends BaseApi {
    restEndpoint = "auto_macro/read";
    restPost = true;
    websocketMethod = "auto_macro_read";

    async handle(data: any): Promise<any> {
        try {
            return {
                status: "okay",
                ...readAutoMacroFile(data?.path ?? data?.file ?? data?.name),
            };
        } catch (error: any) {
            return { error: error?.message ?? "read failed" };
        }
    }
}
