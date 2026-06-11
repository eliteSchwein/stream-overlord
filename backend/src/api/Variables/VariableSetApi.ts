import BaseApi from "../../abstracts/BaseApi";
import {setVariable} from "../../helper/VariableHelper";

export default class VariableSetApi extends BaseApi {
    restEndpoint = "variables/set";
    restPost = true;
    websocketMethod = "variables_set";

    async handle(data: any): Promise<any> {
        const key = data?.key;

        if (!key) {
            return { error: "variable key missing" };
        }

        if (data?.value === undefined) {
            return { error: "variable value missing" };
        }

        const toFile = data.to_file === true || data.toFile === true;

        await setVariable(key, data.value, toFile);

        return {
            key,
            value: data.value,
            to_file: toFile,
        };
    }
}
