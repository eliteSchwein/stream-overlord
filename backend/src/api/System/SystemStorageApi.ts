import BaseApi from "../../abstracts/BaseApi";
import {getSystemStorageInfo} from "../../helper/SystemStorageHelper";

export default class SystemStorageApi extends BaseApi {
    restEndpoint = "system/storage";
    restPost = true;
    websocketMethod = "system_storage";

    async handle(): Promise<any> {
        try {
            return getSystemStorageInfo();
        } catch (error: any) {
            return { error: error?.message ?? "storage info failed" };
        }
    }
}