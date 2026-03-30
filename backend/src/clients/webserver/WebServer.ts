import { getConfig } from "../../helper/ConfigHelper";
import cors from "cors";
import { logDebug, logRegular, logSuccess, logWarn } from "../../helper/LogHelper";
import express, { Express, NextFunction, Request, Response } from "express";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import TestApi from "./api/TestApi";
import * as bodyParser from "body-parser";
import TauonStatusApi from "./api/Tauonmb/TauonStatusApi";
import TauonNextApi from "./api/Tauonmb/TauonNextApi";
import TauonBackApi from "./api/Tauonmb/TauonBackApi";
import { registerApiEndpoints } from "../../App";
import { Server } from "node:http";
import YoloboxPreviewApi from "./api/Yolobox/YoloboxPreviewApi";

export default class WebServer {
    app: Express;
    webServer: Server;

    public async initial() {
        const config = getConfig(/webserver/g)[0];
        const twitchConfig = getConfig(/twitch/g)[0];

        logRegular(`initial web server`);

        if (this.webServer) {
            this.webServer.close();
        }

        this.app = express();

        this.app.use(
            cors({
                origin: "*",
                methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                allowedHeaders: [
                    "Content-Type",
                    "Authorization",
                    "Origin",
                    "X-Requested-With",
                    "Accept",
                ],
                credentials: true,
            })
        );

        this.app.use((req, res, next) => {
            logDebug(`webserver request: ${req.url}`);
            next();
        });

        this.app.use(
            "/dist",
            express.static(path.join(__dirname, "../../frontend/dist"))
        );

        const htmlRoot = path.join(__dirname, "../../frontend/src/html");

        // inject transparent background css into served html files
        this.app.use(this.transparentHtmlStatic(htmlRoot));

        // keep normal static serving for everything else in that folder
        this.app.use(express.static(htmlRoot));

        this.app.use(express.static(path.join(__dirname, "../../assets")));
        this.app.use(
            "/compressed",
            express.static(path.join(__dirname, "../../compressed_assets"))
        );

        this.app.use(bodyParser.json());

        this.app.use(
            "/commander",
            express.static(path.join(__dirname, "../../commander/dist"))
        );
        this.app.get(/^\/commander(\/.*)?$/, (req, res) => {
            res.sendFile(path.join(__dirname, "../../commander/dist/index.html"));
        });

        this.webServer = this.app.listen(config.port, "0.0.0.0", () => {
            logSuccess("web server is ready");
        });

        this.app.get("/config.json", (req, res) => {
            res.json(getConfig());
        });

        // Tauon API
        new TauonStatusApi().register(this.app);
        new TauonNextApi().register(this.app);
        new TauonBackApi().register(this.app);

        // Yolobox API
        new YoloboxPreviewApi().register(this.app);

        await registerApiEndpoints();

        if (!twitchConfig.test_mode) return;

        logWarn("enable test endpoints");
        new TestApi().register(this.app);
    }

    private transparentHtmlStatic(rootDir: string) {
        const resolvedRoot = path.resolve(rootDir);

        return async (req: Request, res: Response, next: NextFunction) => {
            if (req.method !== "GET" && req.method !== "HEAD") {
                next();
                return;
            }

            const requestPath = decodeURIComponent(req.path);
            const relativePath = requestPath.replace(/^\/+/, "");
            const ext = path.extname(relativePath);

            const candidates: string[] = [];

            if (!relativePath) {
                candidates.push("index.html");
            } else if (ext === ".html") {
                candidates.push(relativePath);
            } else if (!ext) {
                candidates.push(path.join(relativePath, "index.html"));
                candidates.push(`${relativePath}.html`);
            } else {
                next();
                return;
            }

            for (const candidate of candidates) {
                const fullPath = path.resolve(resolvedRoot, candidate);

                if (!fullPath.startsWith(resolvedRoot)) {
                    continue;
                }

                try {
                    const html = await fs.readFile(fullPath, "utf8");
                    const injectedHtml = this.injectTransparentBackgroundCss(html);

                    res.type("html");
                    if (req.method === "HEAD") {
                        res.status(200).end();
                        return;
                    }

                    res.send(injectedHtml);
                    return;
                } catch {
                    // try next candidate
                }
            }

            next();
        };
    }

    private injectTransparentBackgroundCss(html: string): string {
        const styleTag = `
<style id="transparent-page-background-style">
    html, body {
        background: transparent !important;
    }
</style>`;

        if (html.includes('id="transparent-page-background-style"')) {
            return html;
        }

        if (/<\/head>/i.test(html)) {
            return html.replace(/<\/head>/i, `${styleTag}\n</head>`);
        }

        if (/<body[^>]*>/i.test(html)) {
            return html.replace(/<body([^>]*)>/i, `<body$1>${styleTag}`);
        }

        return `${styleTag}\n${html}`;
    }

    public getExpress() {
        return this.app;
    }

    public getExpressServer() {
        return this.webServer;
    }
}