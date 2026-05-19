import { Express } from 'express'
import multer from 'multer'
import path from 'path'
import BaseApi from '../BaseApi'
import {addRegularMusicFileFromUpload} from "../../../../helper/MusicHelper";

const allowedExtensions = ['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.opus']

export default class MusicPlaylistAddApi extends BaseApi {
    endpoint = 'music/playlist/add'
    post = true

    public register(webServer: Express) {
        this.webServer = webServer

        const upload = multer({
            storage: multer.memoryStorage(),
            limits: {
                fileSize: 500 * 1024 * 1024,
                files: 20,
            },
            fileFilter: (req, file, cb) => {
                const ext = path.extname(file.originalname).toLowerCase()
                cb(null, allowedExtensions.includes(ext))
            },
        })

        this.webServer.post(
            `/api/${this.endpoint}`,
            upload.any(),
            async (req, res) => {
                res.json(await this.handle(req as any))
            },
        )
    }

    async handle(req: any): Promise<any> {
        try {
            const files = req.files ?? []

            if (files.length === 0) {
                return {
                    data: {
                        error: true,
                        message: 'no valid music files uploaded',
                    },
                    status: 400,
                }
            }

            const added = []

            for (const file of files) {
                added.push(await addRegularMusicFileFromUpload(file))
            }

            return {
                data: {
                    status: 'okay',
                    added,
                },
                status: 200,
            }
        } catch (error) {
            return {
                data: {
                    error: true,
                    message: error?.message ?? 'add failed',
                },
                status: 400,
            }
        }
    }
}