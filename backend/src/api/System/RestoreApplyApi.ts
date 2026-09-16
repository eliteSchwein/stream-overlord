import BaseApi from "../../abstracts/BaseApi";
import {applyStagedRestore} from "../../helper/BackupRestoreHelper";

export default class RestoreApplyApi extends BaseApi {
    restEndpoint = "system/restore/apply";
    restPost = true;
    websocketMethod = "restore_apply";

    async handle(data: any): Promise<any> {
        try {
            const restoreId = String(data?.restore_id ?? data?.restoreId ?? "").trim();
            if (!restoreId) throw new Error("restore_id is required");

            return await applyStagedRestore(restoreId, data?.items ?? data?.selected);
        } catch (error: any) {
            return {error: error?.message ?? "restore failed"};
        }
    }
}
