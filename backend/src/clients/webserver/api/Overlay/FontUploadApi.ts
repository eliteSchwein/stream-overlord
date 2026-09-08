import {Express} from "express";
import BaseApi from "../BaseApi";
import {
    addFontUpload,
    getGeneratedFontCss,
    listFontFiles,
} from "../../../../helper/OverlayStyleManagementHelper";
import multer from "multer";

export default class FontUploadApi extends BaseApi {
    endpoint = "overlay/fonts/upload";
    post = true;

    public register(webServer: Express) {
        this.webServer = webServer;

        const upload = multer({
            storage: multer.memoryStorage(),
            limits: {
                fileSize: 100 * 1024 * 1024,
                files: 50,
            },
        });

        this.webServer.post(
            `/api/${this.endpoint}`,
            upload.any(),
            async (req, res) => {
                const result = await this.handle(req as any);
                res.status(result.status).json(result.data);
            },
        );
    }

    async handle(req: any): Promise<any> {
        try {
            const targetFolder = String(
                req.body?.path ??
                req.body?.target_path ??
                req.body?.targetPath ??
                "",
            );

            const files = Array.isArray(req.files) ? req.files : [];
            if (!files.length) {
                throw new Error("no font files uploaded");
            }

            const added: string[] = [];

            for (const file of files) {
                added.push(...await addFontUpload(
                    file.originalname,
                    file.buffer,
                    targetFolder,
                ));
            }

            return {
                data: {
                    status: "okay",
                    added,
                    files: listFontFiles(),
                    generated_css: getGeneratedFontCss(),
                },
                status: 200,
            };
        } catch (error: any) {
            return {
                data: {
                    error: true,
                    message: error?.message ?? "font upload failed",
                },
                status: 400,
            };
        }
    }
}
