import BaseApi from "../../abstracts/BaseApi";
import { deleteVariable } from "../../helper/VariableHelper";

export default class VariableDeleteApi extends BaseApi {
    restEndpoint = "variables/delete";
    restPost = true;
    websocketMethod = "variables_delete";

    async handle(data: any): Promise<any> {
        const key = data?.key;
        const fromFile = !!data?.fromFile;

        if (!key) {
            return { error: "variable key missing" };
        }

        await deleteVariable(key, fromFile);

        return {
            success: true,
            key,
        };
    }
}