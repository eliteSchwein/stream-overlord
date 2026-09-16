import BaseApi from "../../abstracts/BaseApi";
import {getStagedRestore} from "../../helper/BackupRestoreHelper";

export default class RestoreStateApi extends BaseApi {
    restEndpoint = "system/restore/state";
    restPost = true;
    websocketMethod = "restore_state";

    async handle(data: any): Promise<any> {
        const restoreId = String(data?.restore_id ?? data?.restoreId ?? "").trim();
        if (!restoreId) return {error: "restore_id is required"};

        const restore = getStagedRestore(restoreId);
        return restore ?? {error: "restore session not found or expired"};
    }
}
