import {getConfig} from "../../helper/ConfigHelper";
import cors from 'cors';
import {logDebug, logRegular, logSuccess, logWarn} from "../../helper/LogHelper";
import express, {Express} from "express";
import * as path from "node:path";
import TestApi from "./api/TestApi";
import * as bodyParser from "body-parser";
import TimerApi from "./api/TimerApi";
import AlertApi from "./api/AlertApi";
import MacroApi from "./api/MacroApi";
import ObsApi from "./api/ObsApi";
import ShieldApi from "./api/ShieldApi";
import CurrentGameApi from "./api/Games/CurrentGameApi";
import AllGamesApi from "./api/Games/AllGamesApi";
import GetSceneDataApi from "./api/Obs/GetSceneDataApi";
import ReloadBrowserScenesApi from "./api/Obs/ReloadBrowserScenesApi";
import RestartApi from "./api/RestartApi";
import SetGameApi from "./api/Games/SetGameApi";
import GetChannelPointsApi from "./api/ChannelPoints/GetChannelPointsApi";
import ToggleChannelPointApi from "./api/ChannelPoints/ToggleChannelPointApi";
import TauonStatusApi from "./api/Tauonmb/TauonStatusApi";
import TauonNextApi from "./api/Tauonmb/TauonNextApi";
import TauonBackApi from "./api/Tauonmb/TauonBackApi";

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
        this.webServer.get(/^\/commander(\/.*)?$/, (req, res) => {
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
        new TimerApi().register(this.webServer)
        new AlertApi().register(this.webServer)
        new MacroApi().register(this.webServer)
        new ShieldApi().register(this.webServer)
        // new WebRequestApi().register(this.webServer)

        // Games API
        new CurrentGameApi().register(this.webServer)
        new AllGamesApi().register(this.webServer)
        new SetGameApi().register(this.webServer)

        // OBS API
        new ObsApi().register(this.webServer)
        new GetSceneDataApi().register(this.webServer)
        new ReloadBrowserScenesApi().register(this.webServer)

        // ChannelPoints API
        new GetChannelPointsApi().register(this.webServer)
        new ToggleChannelPointApi().register(this.webServer)

        // Tauon API
        new TauonStatusApi().register(this.webServer)
        new TauonNextApi().register(this.webServer)
        new TauonBackApi().register(this.webServer)

        if(!twitchConfig.test_mode) return

        logWarn('enable test endpoints')
        new TestApi().register(this.webServer)
    }
}