import { Express, Request, Response } from "express";
import { getYoloboxClient } from "../../../../App";

export default class YoloboxPreviewApi {
    endpoint: string = "yolobox/preview";
    webServer: Express;
    post = true;

    public register(webServer: Express) {
        this.webServer = webServer;

        if (this.post) {
            this.webServer.post(`/api/${this.endpoint}`, async (req, res) => {
                await this.handle(req, res);
            });
            return;
        }

        this.webServer.get(`/api/${this.endpoint}`, async (req, res) => {
            await this.handle(req, res);
        });
    }

    async handle(req: Request, res: Response): Promise<void> {
        try {
            const data = (req.body ?? {}) as any;

            if (!data.target) {
                res.status(400).json({ error: "Target is required" });
                return;
            }

            // normalize + validate target
            let target = String(data.target).trim();
            target = target.replace(/^\/+/, ""); // remove leading slashes

            // block absolute URLs / protocol tricks / traversal
            if (
                /^https?:\/\//i.test(target) ||
                target.includes("://") ||
                target.includes("\\") ||
                target.startsWith("..") ||
                target.includes("../")
            ) {
                res.status(400).json({ error: "Invalid target" });
                return;
            }

            const yolobox = getYoloboxClient();
            const ip = yolobox.getIp();

            // build url safely (preserves query string if provided)
            const url = new URL(`http://${ip}:8080/`);
            const [pathPart, queryPart] = target.split("?", 2);
            url.pathname = "/" + pathPart;
            if (queryPart) url.search = "?" + queryPart;

            // timeout
            const controller = new AbortController();
            const timeoutMs = 8000;
            const t = setTimeout(() => controller.abort(), timeoutMs);

            const upstream = await fetch(url.toString(), {
                signal: controller.signal,
            }).finally(() => clearTimeout(t));

            // forward status
            res.status(upstream.status);

            // forward some useful headers
            const passthroughHeaders = [
                "content-type",
                "content-length",
                "cache-control",
                "etag",
                "last-modified",
            ] as const;

            for (const h of passthroughHeaders) {
                const v = upstream.headers.get(h);
                if (v) res.setHeader(h, v);
            }

            // read as bytes and send
            const buf = Buffer.from(await upstream.arrayBuffer());
            res.send(buf);
        } catch (err: any) {
            // fetch abort => timeout
            if (err?.name === "AbortError") {
                res.status(504).json({ error: "Upstream request timed out" });
                return;
            }

            res.status(502).json({ error: "Upstream request failed" });
        }
    }
}
