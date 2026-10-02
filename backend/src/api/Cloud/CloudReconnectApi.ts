import BaseApi from "../../abstracts/BaseApi";
import {getCloudClient} from "../../App";

export default class CloudReconnectApi extends BaseApi {
    restEndpoint = "cloud/reconnect";
    restPost = true;
    websocketMethod = "cloud_reconnect";

    async handle() {
        try {
            await getCloudClient().connect();
            return getCloudClient().getState();
        } catch (error: any) {
            return {error: error?.message ?? "failed to reconnect cloud integration"};
        }
    }
}
