import {getConfig} from "../../helper/ConfigHelper";
import cors from 'cors';
import {logDebug, logRegular, logSuccess, logWarn} from "../../helper/LogHelper";
import express, {Express} from "express";
import * as path from "node:path";
import ToggleBadgeApi from "./api/ToggleBadgeApi";
import TestApi from "./api/TestApi";
import * as bodyParser from "body-parser";
import TimerApi from "./api/TimerApi";
import AlertApi from "./api/AlertApi";
import SceneApi from "./api/SceneApi";
import ObsApi from "./api/ObsApi";
import ShieldApi from "./api/ShieldApi";
import WebRequestApi from "./api/WebRequestApi";
import GetGameApi from "./api/GetGameApi";
import GetGamesApi from "./api/GetGamesApi";
import GetSceneDataApi from "./api/Obs/GetSceneDataApi";
import ReloadBrowserScenesApi from "./api/Obs/ReloadBrowserScenesApi";
import RestartApi from "./api/RestartApi";

export default class WebServer {
    webServer: Express

    public initial() {
        const config = getConfig(/webserver/g)[0]
        const twitchConfig = getConfig(/twitch/g)[0]

        logRegular(`initial web server`)

        this.webServer = express();

        this.webServer.use(cors({
            origin: '*', // Allow all origins
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Allow all HTTP methods
            allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept'], // Allow all common headers
            credentials: true, // Optional: Allow cookies to be included in requests
        }));

        this.webServer.use((req, res, next) => {
            logDebug(`webserver request: ${req.url}`)
            next()
        });

        this.webServer.use(express.static(path.join(__dirname, '../../frontend/dist')))
        this.webServer.use(express.static(path.join(__dirname, '../../frontend/src/html')))
        this.webServer.use(express.static(path.join(__dirname, '../../assets')))
        this.webServer.use(bodyParser.json())

        this.webServer.use('/commander', express.static(path.join(__dirname, '../../commander/dist')));
        this.webServer.get('/commander/*', (req, res) => {
            res.sendFile(path.join(__dirname, '../../commander/dist/index.html'));
        });

        this.webServer.listen(config.port, '0.0.0.0', () => {
            logSuccess('web server is ready')
        })

        this.webServer.get('/config.json',
            (req, res) => {
                res.json(getConfig())
            })


        // General API
        new RestartApi().register(this.webServer)

        // Scene API
        new ToggleBadgeApi().register(this.webServer)
        new TimerApi().register(this.webServer)
        new AlertApi().register(this.webServer)
        new SceneApi().register(this.webServer)
        new ShieldApi().register(this.webServer)
        // new WebRequestApi().register(this.webServer)

        // Games API
        new GetGameApi().register(this.webServer)
        new GetGamesApi().register(this.webServer)

        // OBS API
        new ObsApi().register(this.webServer)
        new GetSceneDataApi().register(this.webServer)
        new ReloadBrowserScenesApi().register(this.webServer)

        if(!twitchConfig.test_mode) return

        logWarn('enable test endpoints')
        new TestApi().register(this.webServer)
    }
}