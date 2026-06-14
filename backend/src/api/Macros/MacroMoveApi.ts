import BaseApi from "../../abstracts/BaseApi";
import { moveMacroFile } from "../../helper/MacroHelper";

export default class MacroMoveApi extends BaseApi {
    restEndpoint = "macro/move";
    restPost = true;
    websocketMethod = "macro_move";

    async handle(data: any): Promise<any> {
        try {
            return {
                status: "okay",
                ...moveMacroFile(data?.source, data?.target),
            };
        } catch (error: any) {
            return { error: error?.message ?? "move failed" };
        }
    }
}
