import BaseApi from "../../abstracts/BaseApi";
import {addObsIntegration} from "../../helper/IntegrationsHelper";
import {getOBSClient} from "../../App";

export default class OBSAddApi extends BaseApi {
    restEndpoint = "obs/add";
    restPost = true;
    websocketMethod = "obs_add";

    async handle(data: any) {
        try {
            const name = String(data.name ?? "default").trim() || "default";
            const ip = String(data.ip ?? "").trim();
            const port = Number(data.port ?? 4455);
            const password = String(data.password ?? "");

            if (!ip) {
                return {error: "OBS ip is required"};
            }

            if (!Number.isFinite(port) || port <= 0) {
                return {error: "OBS port is invalid"};
            }

            addObsIntegration(name, {
                ip,
                port,
                password,
            });

            await getOBSClient().connect();

            return {status: "okay"};
        } catch (error) {
            return {
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
}
