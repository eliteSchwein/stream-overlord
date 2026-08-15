import BaseApi from "../../abstracts/BaseApi";
import {setOllamaExternalIntegration} from "../../helper/IntegrationsHelper";

export default class OllamaExternalApi extends BaseApi {
    restEndpoint = "ollama/external";
    restPost = true;
    websocketMethod = "ollama_external";

    async handle(data: any): Promise<any> {
        try {
            await setOllamaExternalIntegration({
                external: Boolean(data?.external),
                external_url: String(data?.external_url ?? ""),
                api_key: data?.api_key,
                clear_api_key: data?.clear_api_key === true,
            });

            return {success: true};
        } catch (error: any) {
            return {
                error: error?.message ?? "failed to configure external ollama server",
            };
        }
    }
}
