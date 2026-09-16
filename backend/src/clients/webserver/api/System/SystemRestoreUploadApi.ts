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
                    const ext = path.extname(file.originalname).toLowerCase();
                    callback(null, `streambot-restore-upload-${randomUUID()}${ext || ".zip"}`);
                },
            }),
            limits: {
                fileSize: 20 * 1024 * 1024 * 1024,
                files: 1,
            },
            fileFilter: (_req, file, callback) => {
                const accepted = file.originalname.toLowerCase().endsWith(".zip") ||
                    file.mimetype === "application/zip" ||
                    file.mimetype === "application/x-zip-compressed";
                callback(accepted ? null : new Error("restore file must be a zip archive"), accepted);
            },
        });

        this.webServer.post(
            `/api/${this.endpoint}`,
            upload.single("file"),
            async (req, res) => {
                try {
                    if (!req.file) throw new Error("restore zip is required");

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
