import {Express} from "express";
import BaseApi from "../BaseApi";
import {getCurrentSystemLog} from "../../../../helper/BackupRestoreHelper";

export default class SystemLogDownloadApi extends BaseApi {
    endpoint = "system/log/download";

    public register(webServer: Express) {
        this.webServer = webServer;

        const handler = async (req: any, res: any) => {
            try {
                const scope = typeof req.query.scope === "string" ? req.query.scope : "combined";
                const log = await getCurrentSystemLog(scope);

                res.setHeader("Content-Type", "text/plain; charset=utf-8");
                res.setHeader("Content-Disposition", `attachment; filename="${log.filename}"`);
                res.send(log.content);
            } catch (error: any) {
                res.status(500).json({error: true, message: error?.message ?? "failed to read system log"});
            }
        };

        this.webServer.get(`/api/${this.endpoint}`, handler);
        this.webServer.get("/api/system/log", handler);
    }
}
