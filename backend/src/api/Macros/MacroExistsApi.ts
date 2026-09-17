import BaseApi from "../../abstracts/BaseApi";
import {isMacroPresent} from "../../helper/MacroHelper";

export default class MacroExistsApi extends BaseApi {
    restEndpoint = "macro/exists";
    restPost = true;
    websocketMethod = "macro_exists";

    async handle(data: any): Promise<any> {
        const name = String(data?.name ?? "").trim();

        if (!name) {
            return {error: "macro name is required"};
        }

        return {
            name,
            exists: isMacroPresent(name),
        };
    }
}
