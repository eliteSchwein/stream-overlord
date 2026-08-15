import BaseApi from "../../abstracts/BaseApi";
import {directOllamaRequest} from "../../helper/OllamaHelper";

export default class OllamaDirectApi extends BaseApi {
    restEndpoint = "ollama/direct";
    restPost = true;
    websocketMethod = "ollama_direct";

    async handle(data: any): Promise<any> {
        try {
            return await directOllamaRequest(data);
        } catch (error: any) {
            return {error: error?.message ?? "ollama request failed"};
        }
    }
}
