import {getConfig, getSystemConfigDirectory} from "../../helper/ConfigHelper";
import cors from "cors";
import { logDebug, logRegular, logSuccess, logWarn } from "../../helper/LogHelper";
import express, { Express, NextFunction, Request, Response } from "express";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import TestApi from "./api/TestApi";
import * as bodyParser from "body-parser";
import { registerApiEndpoints } from "../../App";
import { redis } from "../redis/Redis";
import { Server } from "node:http";
import YoloboxPreviewApi from "./api/Yolobox/YoloboxPreviewApi";
import MusicPlaylistAddApi from "./api/Music/MusicPlaylistAddApi";
import { getRemoteCacheDirectory } from "../../helper/RemoteCacheHelper";
import AssetsUploadApi from "./api/Assets/AssetsUploadApi";
import OverlaysUploadApi from "./api/Overlay/OverlaysUploadApi";
import { setOverlayCacheRebuildHandler } from "../../helper/OverlayManagementHelper";
import MacrosUploadApi from "./api/Macros/MacrosUploadApi";

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

        const htmlRoot = this.getHtmlRoot();

        setOverlayCacheRebuildHandler(() => this.precacheConfiguredHtmlTemplates());

        await this.precacheConfiguredHtmlTemplates();

        // custom HTML serving with template expansion + transparent background injection
        this.app.use(this.transparentHtmlStatic(htmlRoot));

        // normal static serving for other files in that folder
        this.app.use(express.static(htmlRoot));

        this.app.use(express.static(path.join(getSystemConfigDirectory(), "assets")));
        this.app.use(
            "/compressed",
            express.static(path.join(getSystemConfigDirectory(), "compressed_assets"))
        );

        this.app.use(
            "/remote-cache",
            express.static(getRemoteCacheDirectory())
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

        // Overlay API
        new OverlaysUploadApi().register(this.app);

        // Music API
        new MusicPlaylistAddApi().register(this.app)

        // Assets API
        new AssetsUploadApi().register(this.app)

        // Yolobox API
        new YoloboxPreviewApi().register(this.app)

        // Macro API
        new MacrosUploadApi().register(this.app)

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

                if (!this.isPathInsideRoot(fullPath, resolvedRoot)) {
                    continue;
                }

                try {
                    await fs.access(fullPath);
                } catch {
                    continue;
                }

                try {
                    const html = await this.renderHtmlFile(fullPath, resolvedRoot);
                    const injectedHtml = this.injectTransparentBackgroundCss(html);

                    res.type("html");

                    if (req.method === "HEAD") {
                        res.status(200).end();
                        return;
                    }

                    res.send(injectedHtml);
                    return;
                } catch (error) {
                    logWarn(
                        `failed to render html template "${fullPath}": ${
                            error instanceof Error ? error.message : String(error)
                        }`
                    );
                    next(error);
                    return;
                }
            }

            next();
        };
    }

    public async precacheConfiguredHtmlTemplates() {
        logRegular(`pre-caching all html templates`);
        await this.precacheAllHtmlTemplates(this.getHtmlRoot());
    }

    private getHtmlRoot() {
        return path.join(getSystemConfigDirectory(), "streambot-overlays");
    }

    private async precacheAllHtmlTemplates(rootDir: string) {
        const resolvedRoot = path.resolve(rootDir);

        try {
            await fs.mkdir(resolvedRoot, { recursive: true });
        } catch (error) {
            logWarn(
                `failed to create html template root "${resolvedRoot}": ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
            return;
        }

        const templates = await this.findHtmlTemplates(resolvedRoot, resolvedRoot);

        if (!templates.length) return;

        for (const template of templates) {
            try {
                await this.renderHtmlFile(template, resolvedRoot, [], true);
            } catch (error) {
                logWarn(
                    `failed to precache template "${path.relative(resolvedRoot, template)}": ${
                        error instanceof Error ? error.message : String(error)
                    }`
                );
            }
        }
    }

    private async findHtmlTemplates(directory: string, rootDir: string): Promise<string[]> {
        if (!this.isPathInsideRoot(directory, rootDir)) return [];

        let entries: import("node:fs").Dirent[];

        try {
            entries = await fs.readdir(directory, { withFileTypes: true });
        } catch (error) {
            logWarn(
                `failed to read html template directory "${directory}": ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
            return [];
        }

        const templates: string[] = [];

        for (const entry of entries) {
            const fullPath = path.join(directory, entry.name);

            if (!this.isPathInsideRoot(fullPath, rootDir)) continue;

            if (entry.isDirectory()) {
                templates.push(...await this.findHtmlTemplates(fullPath, rootDir));
                continue;
            }

            if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".html") {
                templates.push(fullPath);
            }
        }

        return templates.sort((a, b) => a.localeCompare(b));
    }

    private async renderHtmlFile(
        filePath: string,
        rootDir: string,
        includeStack: string[] = [],
        refreshCache = false
    ): Promise<string> {
        const resolvedFile = path.resolve(filePath);
        const resolvedRoot = path.resolve(rootDir);

        if (!this.isPathInsideRoot(resolvedFile, resolvedRoot)) {
            throw new Error(`template path is outside allowed root: ${filePath}`);
        }

        if (includeStack.includes(resolvedFile)) {
            const chain = [...includeStack, resolvedFile]
                .map((p) => path.relative(resolvedRoot, p))
                .join(" -> ");

            throw new Error(`circular template include detected: ${chain}`);
        }

        const cacheKey = this.getTemplateCacheKey(resolvedFile, resolvedRoot);

        if (!refreshCache) {
            const cachedHtml = await redis.getVariable(cacheKey);

            if (cachedHtml) {
                return cachedHtml;
            }
        }

        const html = await fs.readFile(resolvedFile, "utf8");
        const renderedHtml = await this.expandTemplateTags(
            html,
            path.dirname(resolvedFile),
            resolvedRoot,
            [...includeStack, resolvedFile]
        );

        await redis.setVariable(cacheKey, renderedHtml);

        return renderedHtml;
    }

    private async expandTemplateTags(
        html: string,
        currentDir: string,
        rootDir: string,
        includeStack: string[]
    ): Promise<string> {
        // supports:
        // <template path="partials/example.html">
        // <template path="partials/example.html" />
        // <template path="partials/example.html"></template>
        const templateRegex =
            /<template\b[^>]*\bpath=(["'])(.*?)\1[^>]*\/?>\s*(?:<\/template>)?/gi;

        let result = "";
        let lastIndex = 0;

        for (const match of html.matchAll(templateRegex)) {
            const fullMatch = match[0];
            const includePathRaw = match[2]?.trim();

            if (match.index == null) continue;

            result += html.slice(lastIndex, match.index);

            if (!includePathRaw) {
                result += fullMatch;
                lastIndex = match.index + fullMatch.length;
                continue;
            }

            const includeFile = includePathRaw.startsWith("/")
                ? path.resolve(rootDir, `.${includePathRaw}`)
                : path.resolve(currentDir, includePathRaw);

            const renderedInclude = await this.renderHtmlFile(
                includeFile,
                rootDir,
                includeStack
            );

            result += this.stripHeadFromHtml(renderedInclude);
            lastIndex = match.index + fullMatch.length;
        }

        result += html.slice(lastIndex);
        return result;
    }


    private stripHeadFromHtml(html: string): string {
        return html
            .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, "")
            .replace(/<!doctype\s+html[^>]*>/gi, "")
            .replace(/<\/?html\b[^>]*>/gi, "")
            .replace(/<body\b[^>]*>/gi, "")
            .replace(/<\/body>/gi, "");
    }

    private resolveTemplateCandidates(templateName: string, rootDir: string): string[] {
        const normalizedName = templateName.replace(/^\/+/, "");
        const ext = path.extname(normalizedName);

        if (ext) {
            return [path.resolve(rootDir, normalizedName)];
        }

        return [
            path.resolve(rootDir, `${normalizedName}.html`),
            path.resolve(rootDir, normalizedName, "index.html")
        ];
    }

    private getTemplateCacheKey(filePath: string, rootDir: string): string {
        const relativeName = path
            .relative(rootDir, filePath)
            .replace(/\\/g, "/")
            .replace(/\.html$/i, "")
            .replace(/\/index$/i, "");

        return `template_${relativeName}`;
    }

    private isPathInsideRoot(targetPath: string, rootDir: string): boolean {
        const relative = path.relative(rootDir, targetPath);
        return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
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