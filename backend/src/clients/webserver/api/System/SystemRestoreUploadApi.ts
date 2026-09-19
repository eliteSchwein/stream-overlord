import {Express} from "express";
import * as os from "node:os";
import * as path from "node:path";
import {randomUUID} from "node:crypto";
import BaseApi from "../BaseApi";
import multer from "multer";
import {stageRestoreArchive} from "../../../../helper/BackupRestoreHelper";

export default class SystemRestoreUploadApi extends BaseApi {
    endpoint = "system/restore";
    post = true;

    public register(webServer: Express) {
        this.webServer = webServer;

        const upload = multer({
            storage: multer.diskStorage({
                destination: os.tmpdir(),
                filename: (_req, file, callback) => {
                    const lower = file.originalname.toLowerCase();
                    const suffix = lower.endsWith(".tar.zst") ? ".tar.zst"
                        : lower.endsWith(".tar.gz") ? ".tar.gz"
                            : lower.endsWith(".tar.xz") ? ".tar.xz"
                                : lower.endsWith(".tar.bz2") ? ".tar.bz2"
                                    : path.extname(lower) || ".archive";
                    callback(null, `streambot-restore-upload-${randomUUID()}${suffix}`);
                },
            }),
            limits: {
                fileSize: 20 * 1024 * 1024 * 1024,
                files: 1,
            },
            fileFilter: (_req, file, callback) => {
                const name = file.originalname.toLowerCase();
                const accepted = [
                    ".tar.zst", ".tzst",
                    ".tar.gz", ".tgz",
                    ".tar.xz", ".txz",
                    ".tar.bz2", ".tbz2", ".tbz",
                    ".tar", ".zip",
                ].some((extension) => name.endsWith(extension));
                callback(accepted ? null : new Error(
                    "unsupported restore archive; use .tar.zst, .tar, .tar.gz/.tgz, .tar.xz, .tar.bz2, or .zip",
                ), accepted);
            },
        });

        this.webServer.post(
            `/api/${this.endpoint}`,
            upload.single("file"),
            async (req, res) => {
                try {
                    if (!req.file) throw new Error("restore archive is required");

                    const staged = await stageRestoreArchive(req.file.path, req.file.originalname);
                    res.json({data: staged, status: 200});
                } catch (error: any) {
                    res.status(400).json({
                        data: {error: true, message: error?.message ?? "restore upload failed"},
                        status: 400,
                    });
                }
            },
        );
    }
}
