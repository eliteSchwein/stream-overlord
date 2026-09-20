import {Express} from "express";
import {createReadStream} from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import BaseApi from "../BaseApi";
import {createBotBackup} from "../../../../helper/BackupRestoreHelper";

export default class SystemBackupApi extends BaseApi {
    endpoint = "system/backup";

    public register(webServer: Express) {
        this.webServer = webServer;

        this.webServer.get(`/api/${this.endpoint}`, async (_req, res) => {
            let backup: Awaited<ReturnType<typeof createBotBackup>> | undefined;

            try {
                backup = await createBotBackup();
                const stat = await fs.stat(backup.path);

                res.status(200);
                res.setHeader("Content-Type", "application/zstd");
                res.setHeader("Content-Length", String(stat.size));
                res.setHeader(
                    "Content-Disposition",
                    `attachment; filename="${backup.filename.replace(/"/g, "")}"`,
                );
                res.setHeader("X-Content-Type-Options", "nosniff");

                const stream = createReadStream(backup.path);

                const cleanup = async () => {
                    await fs.rm(backup!.path, {force: true}).catch(() => undefined);
                    await fs.rm(path.dirname(backup!.path), {recursive: true, force: true}).catch(() => undefined);
                };

                stream.on("error", async (error) => {
                    await cleanup();
                    if (!res.headersSent) {
                        res.status(500).json({error: true, message: error.message});
                    } else {
                        res.destroy(error);
                    }
                });

                res.on("finish", cleanup);
                res.on("close", cleanup);

                stream.pipe(res);
            } catch (error: any) {
                if (backup) {
                    await fs.rm(backup.path, {force: true}).catch(() => undefined);
                    await fs.rm(path.dirname(backup.path), {recursive: true, force: true}).catch(() => undefined);
                }

                if (!res.headersSent) {
                    res.status(500).json({error: true, message: error?.message ?? "backup failed"});
                }
            }
        });
    }
}
