import BaseApi from "../../abstracts/BaseApi";
import {updateAllManagers} from "../../helper/UpdateHelper";

export default class UpdateAllApi extends BaseApi {
    restEndpoint = "system/update/all";
    restPost = true;
    websocketMethod = "update_all";

    async handle(): Promise<any> {
        return await updateAllManagers();
    }
}
