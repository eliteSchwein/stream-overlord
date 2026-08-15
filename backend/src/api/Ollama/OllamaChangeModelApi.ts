import BaseApi from "../../abstracts/BaseApi";
import {changeOllamaModel} from "../../helper/OllamaHelper";

export default class OllamaChangeModelApi extends BaseApi {
    restEndpoint = "ollama/changemodel";
    restPost = true;
    websocketMethod = "ollama_change_model";

    async handle(data: any): Promise<any> {
        try {
            return await changeOllamaModel(data?.model);
        } catch (error: any) {
            return {error: error?.message ?? "failed to change ollama model"};
        }
    }
}
