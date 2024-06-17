import {Express} from "express";

export default class BaseApi {
    endpoint: string
    webServer: Express
    post = false

    public register(webServer: Express) {
        this.webServer = webServer

        if(this.post) {
            this.webServer.post(`/api/${this.endpoint}`,
                async (req, res) =>
                    // @ts-ignore
                    res.json(await this.handle(req)))

            return
        }

        this.webServer.get(`/api/${this.endpoint}`,
            async (req, res) =>
                // @ts-ignore
                res.json(await this.handle(req)))
    }

    async handle(req: Request): Promise<any> {

    }
}