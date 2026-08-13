import BaseApi from "../../abstracts/BaseApi";
import {checkUpdates, updateManager} from "../../helper/UpdateHelper";

export default class UpdateApi extends BaseApi {
    restEndpoint = "system/update";
    websocketMethod = "update";

    async handle(data: any): Promise<any> {
        if (data?.action === "check") {
            return await checkUpdates();
        }

        if (!data?.name) {
            throw new Error("update manager name is required");
        }

        return await updateManager(String(data.name));
    }
}
