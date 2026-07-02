import BaseApi from "../../abstracts/BaseApi";
import {addWledIntegration} from "../../helper/IntegrationsHelper";

export default class WledAddApi extends BaseApi {
    restEndpoint = "wled/add";
    restPost = true;
    websocketMethod = "wled_add";

    async handle(data: any) {
        try {
            const name = String(data.name ?? "").trim();

            addWledIntegration(name, {
                ip: String(data.ip ?? "").trim(),
            });

            return {status: "okay"};
        } catch (error) {
            return {
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
}