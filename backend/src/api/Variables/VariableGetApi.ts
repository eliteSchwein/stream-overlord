import BaseApi from "../../abstracts/BaseApi";
import {getVariable} from "../../helper/VariableHelper";

export default class VariableGetApi extends BaseApi {
    restEndpoint = "variables/get";
    restPost = true;
    websocketMethod = "variables_get";

    async handle(data: any): Promise<any> {
        const key = data?.key;

        if (!key) {
            return { error: "variable key missing" };
        }

        return {
            key,
            value: await getVariable(key),
        };
    }
}
