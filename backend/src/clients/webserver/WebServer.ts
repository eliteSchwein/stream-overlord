import {getConfig} from "../../helper/ConfigHelper";
import cors from 'cors';
import {logDebug, logRegular, logSuccess, logWarn} from "../../helper/LogHelper";
import express, {Express} from "express";
import * as path from "node:path";
import TestApi from "./api/TestApi";
import * as bodyParser from "body-parser";
import TauonStatusApi from "./api/Tauonmb/TauonStatusApi";
import TauonNextApi from "./api/Tauonmb/TauonNextApi";
import TauonBackApi from "./api/Tauonmb/TauonBackApi";
import {registerApiEndpoints} from "../../App";
import {Server} from "node:http";
import YoloboxPreviewApi from "./api/Yolobox/YoloboxPreviewApi";

export default class WebServer {
    app: Express
    webServer: Server

    public async initial() {
        const config = getConfig(/webserver/g)[0]
        const twitchConfig = getConfig(/twitch/g)[0]

        logRegular(`initial web server`)

        if(this.webServer) {
            this.webServer.close()
        }

        this.app = express();

        this.app.use(cors({
            origin: '*', // Allow all origins
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Allow all HTTP methods
            allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'X-Requested-With', 'Accept'], // Allow all common headers
            credentials: true, // Optional: Allow cookies to be included in requests
        }));

        this.app.use((req, res, next) => {
            logDebug(`webserver request: ${req.url}`)
            next()
        });

        this.app.use(
            '/dist',
            express.static(path.join(__dirname, '../../frontend/dist'))
        )
        this.app.use(express.static(path.join(__dirname, '../../frontend/src/html')))
        this.app.use(express.static(path.join(__dirname, '../../assets')))
        this.app.use(
            '/compressed',
            express.static(path.join(__dirname, '../../compressed_assets'))
        )

        this.app.use(bodyParser.json())

        this.app.use('/commander', express.static(path.join(__dirname, '../../commander/dist')));
        this.app.get(/^\/commander(\/.*)?$/, (req, res) => {
            res.sendFile(path.join(__dirname, '../../commander/dist/index.html'));
        });

        this.webServer = this.app.listen(config.port, '0.0.0.0', () => {
            logSuccess('web server is ready')
        })

        this.app.get('/config.json',
            (req, res) => {
                res.json(getConfig())
            })

        // Tauon API
        new TauonStatusApi().register(this.app)
        new TauonNextApi().register(this.app)
        new TauonBackApi().register(this.app)

        // Yolobox API
        new YoloboxPreviewApi().register(this.app)

        await registerApiEndpoints()

        if(!twitchConfig.test_mode) return

        logWarn('enable test endpoints')
        new TestApi().register(this.app)
    }

    public getExpress() {
        return this.app
    }

    public getExpressServer() {
        return this.webServer
    }
}