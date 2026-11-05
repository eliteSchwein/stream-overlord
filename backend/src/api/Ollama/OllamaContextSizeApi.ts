import BaseApi from "../../abstracts/BaseApi";
import {changeOllamaContextSize} from "../../helper/OllamaHelper";

export default class OllamaContextSizeApi extends BaseApi {
    restEndpoint = "ollama/contextsize";
    restPost = true;
    websocketMethod = "ollama_context_size";

    async handle(data: any): Promise<any> {
        try {
            return await changeOllamaContextSize(
                data?.context_size ?? data?.contextSize,
            );
        } catch (error: any) {
            return {error: error?.message ?? "failed to change ollama context size"};
        }
    }
}
