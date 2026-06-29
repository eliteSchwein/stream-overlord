import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {logDebug, logWarn} from "./LogHelper";

export type SourceBackgroundPayload = {
    background?: string | null;
    backgrounds?: Record<string, string | null> | string[] | null;
    [key: string]: any;
};

const REMOTE_CACHE_DIR = "/tmp/streambot-remote-cache";
const REMOTE_CACHE_ROUTE = "/remote-cache";

export function getRemoteCacheDirectory() {
    return REMOTE_CACHE_DIR;
}

export default class RemoteCacheHelper {

    public static async cacheGameInfo<T extends Record<string, any>>(data: T): Promise<T> {
        if (!data?.media || typeof data.media !== "object") return data;

        const cachedData = {
            ...data,
            media: {
                ...data.media,
                source_backgrounds: { ...(data.media.source_backgrounds ?? {}) }
            }
        } as T;

        const media = cachedData.media;

        for (const key of [
            "cover",
            "static_background",
            "source_background",
            "animated_background"
        ]) {
            if (typeof media[key] === "string") {
                media[key] = await this.cacheUrlSafe(media[key]);
            }
        }

        if (media.source_backgrounds && typeof media.source_backgrounds === "object") {
            for (const [key, url] of Object.entries(media.source_backgrounds)) {
                if (typeof url !== "string") continue;

                media.source_backgrounds[key] = await this.cacheUrlSafe(url);
            }
        }

        return cachedData;
    }

    public static async cacheSourceUpdate<T extends SourceBackgroundPayload>(data: T): Promise<T> {
        if (!data) return data;

        const cachedData = {
            ...data,
            backgrounds: Array.isArray(data.backgrounds)
                ? [...data.backgrounds]
                : { ...(data.backgrounds ?? {}) }
        } as T;

        if (typeof data.background === "string") {
            cachedData.background = await this.cacheUrlSafe(data.background);
        }

        if (data.backgrounds && typeof data.backgrounds === "object") {
            for (const [key, url] of Object.entries(data.backgrounds)) {
                if (typeof url !== "string") continue;

                (cachedData.backgrounds as Record<string, string>)[key] = await this.cacheUrlSafe(url);
            }
        }

        return cachedData;
    }

    private static async cacheUrlSafe(url: string): Promise<string> {
        try {
            return await this.cacheUrl(url);
        } catch (error) {
            logWarn(
                `remote cache failed for "${url}": ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
            return url;
        }
    }

    private static async cacheUrl(url: string): Promise<string> {
        if (!this.isRemoteUrl(url)) {
            return url;
        }

        await fs.mkdir(REMOTE_CACHE_DIR, { recursive: true });

        const parsedUrl = new URL(url);
        const cleanPath = parsedUrl.pathname;
        const extension = path.extname(cleanPath) || ".cache";
        const hash = crypto.createHash("sha256").update(url).digest("hex");
        const filename = `${hash}${extension}`;
        const targetFile = path.join(REMOTE_CACHE_DIR, filename);

        if (await this.fileExists(targetFile)) {
            return `${REMOTE_CACHE_ROUTE}/${filename}`;
        }

        logDebug(`remote cache download: ${url}`);

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        await fs.writeFile(targetFile, Buffer.from(arrayBuffer));

        return `${REMOTE_CACHE_ROUTE}/${filename}`;
    }

    private static isRemoteUrl(url: string): boolean {
        try {
            const parsedUrl = new URL(url);
            return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
        } catch {
            return false;
        }
    }

    private static async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}
