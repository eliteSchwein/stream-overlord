import {getConfig} from "../../helper/ConfigHelper";
import {logRegular, logSuccess, logWarn} from "../../helper/LogHelper";
import express, { Express, Request, Response } from "express";
import * as path from "node:path";
import ToggleBadgeApi from "./api/ToggleBadgeApi";
import TestApi from "./api/TestApi";
import * as bodyParser from "body-parser";
import TimerApi from "./api/TimerApi";

export default class WebServer {
    webServer: Express

    public initial() {
        const config = getConfig(/webserver/g)[0]
        const twitchConfig = getConfig(/twitch/g)[0]

        logRegular(`initial web server`)

        this.webServer = express();
        this.webServer.use(express.static(path.join(__dirname, '../../frontend/dist')))
        this.webServer.use(express.static(path.join(__dirname, '../../frontend/src/html')))
        this.webServer.use(express.static(path.join(__dirname, '../../assets')))
        this.webServer.use(bodyParser.json())

        this.webServer.listen(config.port, '0.0.0.0', () => {
            logSuccess('web server is ready')
        })

        this.webServer.get('/config.json',
            (req, res) =>
                res.json(getConfig()))

        new ToggleBadgeApi().register(this.webServer)
        new TimerApi().register(this.webServer)

        if(!twitchConfig.test_mode) return

        logWarn('enable test endpoints')
        new TestApi().register(this.webServer)
    }
}