import BaseApi from "../../abstracts/BaseApi";
import {cleanupRestore} from "../../helper/BackupRestoreHelper";

export default class RestoreCancelApi extends BaseApi {
    restEndpoint = "system/restore/cancel";
    restPost = true;
    websocketMethod = "restore_cancel";

    async handle(data: any): Promise<any> {
        const restoreId = String(data?.restore_id ?? data?.restoreId ?? "").trim();
        if (!restoreId) return {error: "restore_id is required"};

        return {
            restore_id: restoreId,
            cancelled: await cleanupRestore(restoreId),
        };
    }
}
