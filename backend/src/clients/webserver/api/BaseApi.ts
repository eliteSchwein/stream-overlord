import {Express} from "express";

export default class BaseApi {
    endpoint: string
    webServer: Express

    public register(webServer: Express) {
        this.webServer = webServer

        this.webServer.get(`/api/${this.endpoint}`,
            async (req, res) =>
                res.json(await this.handle()))
    }

    async handle(): Promise<any> {

    }
}