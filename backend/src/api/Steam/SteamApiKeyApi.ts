import BaseApi from "../../abstracts/BaseApi";
import {setSteamApiKey} from "../../helper/IntegrationsHelper";

export default class SteamApiKeyApi extends BaseApi {
    restEndpoint = "integrations/steam/api-key";
    restPost = true;
    websocketMethod = "integrations_steam_api_key";

    async handle(data: any): Promise<any> {
        try {
            const steam = setSteamApiKey(String(data?.api_key ?? data?.apiKey ?? ""));
            const {emitCategoryLibraryUpdate} = await import("../../helper/CategoryLibraryHelper");
            emitCategoryLibraryUpdate();
            return {status: "okay", steam};
        } catch (error: any) {
            return {error: error?.message ?? "failed to save Steam API key"};
        }
    }
}
