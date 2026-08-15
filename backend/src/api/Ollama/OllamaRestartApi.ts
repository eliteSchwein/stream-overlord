import BaseApi from "../../abstracts/BaseApi";
import {restartOllama} from "../../helper/OllamaHelper";

export default class OllamaRestartApi extends BaseApi {
    restEndpoint = "ollama/restart";
    restPost = true;
    websocketMethod = "ollama_restart";

    async handle(): Promise<any> {
        try {
            return await restartOllama();
        } catch (error: any) {
            return {error: error?.message ?? "failed to restart ollama"};
        }
    }
}
