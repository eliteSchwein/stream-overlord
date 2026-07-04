import BaseApi from "../../abstracts/BaseApi";
import {moveAutoMacroFile} from "../../helper/AutoMacroHelper";

export default class AutoMacroMoveApi extends BaseApi {
    restEndpoint = "auto_macro/move";
    restPost = true;
    websocketMethod = "auto_macro_move";

    async handle(data: any): Promise<any> {
        try {
            return {
                status: "okay",
                ...moveAutoMacroFile(data?.source, data?.target),
            };
        } catch (error: any) {
            return { error: error?.message ?? "move failed" };
        }
    }
}
