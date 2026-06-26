import {Express} from "express";
import BaseApi from "../BaseApi";
import {addCommandFilesFromUpload} from "../../../twitch/TwitchCommands";
import multer from "multer";

export default class CommandsUploadApi extends BaseApi {
    endpoint = "commands/upload";
    post = true;

    public register(webServer: Express) {
        this.webServer = webServer;

        const upload = multer({
            storage: multer.memoryStorage(),
            limits: {
                fileSize: 1024 * 1024 * 1024,
                files: 50,
            },
        });

        this.webServer.post(
            `/api/${this.endpoint}`,
            upload.any(),
            async (req, res) => {
                res.json(await this.handle(req as any));
            },
        );
    }

    async handle(req: any): Promise<any> {
        try {
            const added = await addCommandFilesFromUpload(req.files ?? [], req.body?.path ?? req.body?.targetPath ?? "");

            return {
                data: {
                    status: "okay",
                    added,
                },
                status: 200,
            };
        } catch (error: any) {
            return {
                data: {
                    error: true,
                    message: error?.message ?? "upload failed",
                },
                status: 400,
            };
        }
    }
}
