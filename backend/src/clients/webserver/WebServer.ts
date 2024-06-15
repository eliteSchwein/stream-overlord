import {getConfig} from "../../helper/ConfigHelper";
import {logRegular, logSuccess} from "../../helper/LogHelper";
import express, { Express, Request, Response } from "express";
import * as path from "node:path";

export default class WebServer {
    webServer: Express

    public initial() {
        const config = getConfig(/webserver/g)[0]

        logRegular(`initial web server`)

        this.webServer = express();
        this.webServer.use(express.static(path.join(__dirname, '../../frontend/dist')))

        this.webServer.listen(config.port, '0.0.0.0', () => {
            logSuccess('web server is ready')
        })
    }
}