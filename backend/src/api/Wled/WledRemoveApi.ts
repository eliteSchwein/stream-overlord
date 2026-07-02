import BaseApi from "../../abstracts/BaseApi";
import {removeWledIntegration} from "../../helper/IntegrationsHelper";

export default class WledRemoveApi extends BaseApi {
    restEndpoint = "wled/remove";
    restPost = true;
    websocketMethod = "wled_remove";

    async handle(data: any) {
        try {
            const name = String(data.name ?? "").trim();

            removeWledIntegration(name);

            return {status: "okay"};
        } catch (error) {
            return {
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
}