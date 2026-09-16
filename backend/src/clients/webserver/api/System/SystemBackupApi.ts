import {Express} from "express";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import BaseApi from "../BaseApi";
import {createBotBackup} from "../../../../helper/BackupRestoreHelper";

export default class SystemBackupApi extends BaseApi {
    endpoint = "system/backup";

    public register(webServer: Express) {
        this.webServer = webServer;

        this.webServer.get(`/api/${this.endpoint}`, async (_req, res) => {
            try {
                const backup = await createBotBackup();

                res.download(backup.path, backup.filename, async (error) => {
                    await fs.rm(backup.path, {force: true}).catch(() => undefined);
                    await fs.rm(path.dirname(backup.path), {recursive: true, force: true}).catch(() => undefined);

                    if (error && !res.headersSent) {
                        res.status(500).json({error: true, message: error.message});
                    }
                });
            } catch (error: any) {
                res.status(500).json({error: true, message: error?.message ?? "backup failed"});
            }
        });
    }
}
