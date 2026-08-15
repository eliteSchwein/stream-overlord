import BaseApi from "../../abstracts/BaseApi";
import {setOllamaIntegrationEnabled} from "../../helper/IntegrationsHelper";
import {getOllamaUpdate} from "../../helper/OllamaHelper";

export default class OllamaToggleApi extends BaseApi {
    restEndpoint = "ollama/toggle";
    restPost = true;
    websocketMethod = "ollama_toggle";

    async handle(data: any): Promise<any> {
        try {
            await setOllamaIntegrationEnabled(Boolean(data?.enabled));
            return getOllamaUpdate();
        } catch (error: any) {
            return {error: error?.message ?? "failed to toggle ollama"};
        }
    }
}
