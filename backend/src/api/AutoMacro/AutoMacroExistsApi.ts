import BaseApi from "../../abstracts/BaseApi";
import {isAutoMacroPresent} from "../../helper/AutoMacroHelper";

export default class AutoMacroExistsApi extends BaseApi {
    restEndpoint = "auto_macro/exists";
    restPost = true;
    websocketMethod = "auto_macro_exists";

    async handle(data: any): Promise<any> {
        const name = String(data?.name ?? "").trim();

        if (!name) {
            return {error: "auto macro name is required"};
        }

        return {
            name,
            exists: isAutoMacroPresent(name),
        };
    }
}
