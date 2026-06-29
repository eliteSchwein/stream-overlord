import BaseApi from "../../abstracts/BaseApi";
import {readMacroFile} from "../../helper/MacroHelper";

export default class MacroReadApi extends BaseApi {
    restEndpoint = "macro/read";
    restPost = true;
    websocketMethod = "macro_read";

    async handle(data: any): Promise<any> {
        try {
            return {
                status: "okay",
                ...await readMacroFile(data?.path ?? data?.file ?? data?.name),
            };
        } catch (error: any) {
            return { error: error?.message ?? "read failed" };
        }
    }
}
