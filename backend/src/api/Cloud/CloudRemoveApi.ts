import BaseApi from "../../abstracts/BaseApi";
import {getCloudClient} from "../../App";

export default class CloudRemoveApi extends BaseApi {
    restEndpoint = "cloud/remove";
    restPost = true;
    websocketMethod = "cloud_remove";

    async handle() {
        try {
            return await getCloudClient().removeRegistration();
        } catch (error: any) {
            return {error: error?.message ?? "failed to remove cloud integration"};
        }
    }
}
