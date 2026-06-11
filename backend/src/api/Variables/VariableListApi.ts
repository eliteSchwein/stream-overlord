import BaseApi from "../../abstracts/BaseApi";
import { listVariables } from "../../helper/VariableHelper";

export default class VariableListApi extends BaseApi {
    restEndpoint = "variables/list";
    restPost = true;
    websocketMethod = "variables_list";

    async handle(): Promise<any> {
        return {
            keys: await listVariables(),
        };
    }
}