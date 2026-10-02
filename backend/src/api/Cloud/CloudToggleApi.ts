import BaseApi from "../../abstracts/BaseApi";
import {getCloudClient} from "../../App";

export default class CloudToggleApi extends BaseApi {
    restEndpoint = "cloud/toggle";
    restPost = true;
    websocketMethod = "cloud_toggle";

    async handle(data: any) {
        try {
            return await getCloudClient().setEnabled(Boolean(data?.enabled ?? data?.enable));
        } catch (error: any) {
            return {error: error?.message ?? "failed to toggle cloud integration"};
        }
    }
}
