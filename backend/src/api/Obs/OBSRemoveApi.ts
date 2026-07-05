import BaseApi from "../../abstracts/BaseApi";
import {removeObsIntegration} from "../../helper/IntegrationsHelper";
import {getOBSClient} from "../../App";

export default class OBSRemoveApi extends BaseApi {
    restEndpoint = "obs/remove";
    restPost = true;
    websocketMethod = "obs_remove";

    async handle(data: any) {
        try {
            const name = String(data.name ?? "default").trim() || "default";

            removeObsIntegration(name);

            await getOBSClient().connect();

            return {status: "okay"};
        } catch (error) {
            return {
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
}
