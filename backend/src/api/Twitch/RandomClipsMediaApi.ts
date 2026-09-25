import {Request, Response} from "express";
import BaseApi from "../../abstracts/BaseApi";
import WebsocketServer from "../../clients/websocket/WebsocketServer";
import WebServer from "../../clients/webserver/WebServer";
import {logError, logRegular, logWarn} from "../../helper/LogHelper";

type TwitchClipQuality = {
    frameRate?: number | string;
    quality?: string;
    sourceURL?: string;
};

type TwitchClipGqlResponse = {
    data?: {
        clip?: {
            playbackAccessToken?: {
                signature?: string;
                value?: string;
            };
            videoQualities?: TwitchClipQuality[];
        } | null;
    };
    errors?: Array<{
        message?: string;
    }>;
};

export default class RandomClipsMediaApi extends BaseApi {
    restEndpoint = null;
    restPost = false;
    websocketMethod = null;

    /**
     * Twitch web client ID used by Twitch's own web frontend.
     */
    private readonly twitchWebClientId =
        "kimne78kx3ncx6brgo4mv6wki5h1ko";

    /**
     * Persisted Twitch GraphQL query for resolving clip playback data.
     */
    private readonly clipPersistedQueryHash =
        "993d9a5131f15a37bd16f32342c44ed1e0b1a9b968c6afdb662d2cddd595f6c5";

    public constructor(
        websocketServer: WebsocketServer,
        restServer: WebServer,
    ) {
        super(websocketServer, restServer);
    }

    public registerEndpoints() {
        logRegular(
            "register rest endpoint: /api/random-clips/media/:clipId",
        );

        this.restExpress.get(
            "/api/random-clips/media/:clipId",
            (req: Request, res: Response) => {
                void this.handleMedia(req, res);
            },
        );
    }

    private async handleMedia(
        req: Request,
        res: Response,
    ) {
        const clipId = String(
            req.params.clipId ?? "",
        ).trim();

        if (!clipId) {
            res.status(400).json({
                error: true,
                message: "missing clip id",
            });

            return;
        }

        const abortController =
            new AbortController();

        const abort = () => {
            if (
                !abortController.signal.aborted
            ) {
                abortController.abort();
            }
        };

        req.on(
            "aborted",
            abort,
        );

        try {
            const mediaUrl =
                await this.resolveClipMediaUrl(
                    clipId,
                    abortController.signal,
                );

            if (!mediaUrl) {
                if (!res.headersSent) {
                    res.status(502).json({
                        error: true,
                        message:
                            "unable to resolve Twitch clip media",
                    });
                }

                return;
            }

            await this.proxyMedia(
                mediaUrl,
                req,
                res,
                abortController.signal,
            );
        } catch (error: any) {
            if (
                error?.name === "AbortError"
                || abortController.signal.aborted
            ) {
                return;
            }

            logError(
                `random clip media failed for ${clipId}`,
            );

            logError(
                JSON.stringify(
                    error,
                    Object.getOwnPropertyNames(
                        error,
                    ),
                ),
            );

            if (!res.headersSent) {
                res.status(500).json({
                    error: true,
                    message:
                        "failed to load Twitch clip media",
                });

                return;
            }

            if (!res.writableEnded) {
                res.end();
            }
        } finally {
            req.off(
                "aborted",
                abort,
            );
        }
    }

    private async resolveClipMediaUrl(
        clipId: string,
        signal?: AbortSignal,
    ): Promise<string | null> {
        const response = await fetch(
            "https://gql.twitch.tv/gql",
            {
                method: "POST",

                headers: {
                    "Client-ID":
                    this.twitchWebClientId,

                    "Content-Type":
                        "application/json",

                    "Accept":
                        "application/json",

                    "Origin":
                        "https://clips.twitch.tv",

                    "Referer":
                        `https://clips.twitch.tv/${encodeURIComponent(clipId)}`,

                    "User-Agent":
                        "Mozilla/5.0 (X11; Linux x86_64) "
                        + "AppleWebKit/537.36 "
                        + "(KHTML, like Gecko) "
                        + "Chrome/136.0.0.0 Safari/537.36",
                },

                body: JSON.stringify({
                    operationName:
                        "VideoAccessToken_Clip",

                    variables: {
                        slug: clipId,
                        platform: "web",
                    },

                    extensions: {
                        persistedQuery: {
                            version: 1,
                            sha256Hash:
                            this.clipPersistedQueryHash,
                        },
                    },
                }),

                signal,
            },
        );

        if (!response.ok) {
            const body =
                await response
                    .text()
                    .catch(() => "");

            logWarn(
                `Twitch GQL clip request failed for ${clipId}: `
                + `${response.status} ${response.statusText}`
                + (
                    body
                        ? ` - ${body.substring(0, 500)}`
                        : ""
                ),
            );

            return null;
        }

        const result =
            await response.json() as TwitchClipGqlResponse;

        if (
            Array.isArray(result.errors)
            && result.errors.length
        ) {
            logWarn(
                `Twitch GQL returned errors for ${clipId}: `
                + result.errors
                    .map(
                        error =>
                            String(
                                error?.message
                                ?? "unknown error",
                            ),
                    )
                    .join("; "),
            );
        }

        const clip =
            result?.data?.clip;

        if (!clip) {
            logWarn(
                `Twitch GQL returned no clip for ${clipId}`,
            );

            return null;
        }

        const qualities =
            Array.isArray(
                clip.videoQualities,
            )
                ? clip.videoQualities
                : [];

        const usableQualities =
            qualities
                .filter(
                    (
                        quality,
                    ): quality is TwitchClipQuality & {
                        sourceURL: string;
                    } => {
                        return (
                            typeof quality?.sourceURL
                            === "string"
                            && quality.sourceURL.length > 0
                        );
                    },
                )
                .sort(
                    (a, b) =>
                        this.getQualityScore(b)
                        - this.getQualityScore(a),
                );

        if (!usableQualities.length) {
            logWarn(
                `Twitch GQL returned no playable qualities for ${clipId}`,
            );

            return null;
        }

        const selectedQuality =
            usableQualities[0];

        const sourceUrl =
            selectedQuality.sourceURL;

        let url: URL;

        try {
            url = new URL(
                sourceUrl,
            );
        } catch {
            logWarn(
                `Twitch GQL returned invalid source URL for ${clipId}`,
            );

            return null;
        }

        const signature =
            clip.playbackAccessToken
                ?.signature;

        const token =
            clip.playbackAccessToken
                ?.value;

        /*
         * Some Twitch CDN URLs already contain their auth parameters.
         * Only append them if Twitch didn't include them.
         */
        if (
            signature
            && token
            && !url.searchParams.has("sig")
            && !url.searchParams.has("token")
        ) {
            url.searchParams.set(
                "sig",
                signature,
            );

            url.searchParams.set(
                "token",
                token,
            );
        }

        return url.toString();
    }

    private getQualityScore(
        quality: TwitchClipQuality,
    ) {
        const resolution =
            Number.parseInt(
                String(
                    quality.quality
                    ?? "0",
                ),
                10,
            ) || 0;

        const frameRate =
            Number.parseFloat(
                String(
                    quality.frameRate
                    ?? "0",
                ),
            ) || 0;

        return (
            resolution * 1000
            + frameRate
        );
    }

    private async proxyMedia(
        mediaUrl: string,
        req: Request,
        res: Response,
        signal?: AbortSignal,
    ) {
        const headers:
            Record<string, string> = {
            "Accept": "*/*",

            "User-Agent":
                "Mozilla/5.0 (X11; Linux x86_64) "
                + "AppleWebKit/537.36 "
                + "(KHTML, like Gecko) "
                + "Chrome/136.0.0.0 Safari/537.36",

            "Referer":
                "https://clips.twitch.tv/",

            "Origin":
                "https://clips.twitch.tv",
        };

        const range =
            req.headers.range;

        if (range) {
            headers.Range =
                range;
        }

        const upstream =
            await fetch(
                mediaUrl,
                {
                    method: "GET",

                    headers,

                    redirect:
                        "follow",

                    signal,
                },
            );

        if (
            !upstream.ok
            && upstream.status !== 206
        ) {
            const body =
                await upstream
                    .text()
                    .catch(() => "");

            logWarn(
                `Twitch clip CDN returned `
                + `${upstream.status} `
                + `${upstream.statusText}`
                + (
                    body
                        ? ` - ${body.substring(0, 300)}`
                        : ""
                ),
            );

            if (!res.headersSent) {
                res.status(
                    upstream.status,
                ).end();
            }

            return;
        }

        res.status(
            upstream.status,
        );

        this.copyHeader(
            upstream,
            res,
            "content-type",
        );

        this.copyHeader(
            upstream,
            res,
            "content-length",
        );

        this.copyHeader(
            upstream,
            res,
            "content-range",
        );

        this.copyHeader(
            upstream,
            res,
            "accept-ranges",
        );

        this.copyHeader(
            upstream,
            res,
            "etag",
        );

        this.copyHeader(
            upstream,
            res,
            "last-modified",
        );

        res.setHeader(
            "Cache-Control",
            "public, max-age=300",
        );

        res.setHeader(
            "Access-Control-Allow-Origin",
            "*",
        );

        res.setHeader(
            "Cross-Origin-Resource-Policy",
            "cross-origin",
        );

        if (!upstream.body) {
            res.end();
            return;
        }

        const reader =
            upstream.body.getReader();

        try {
            while (true) {
                const {
                    done,
                    value,
                } =
                    await reader.read();

                if (done) {
                    break;
                }

                if (
                    res.destroyed
                    || res.writableEnded
                ) {
                    break;
                }

                const canContinue =
                    res.write(
                        Buffer.from(
                            value,
                        ),
                    );

                if (!canContinue) {
                    await new Promise<void>(
                        resolve => {
                            res.once(
                                "drain",
                                resolve,
                            );
                        },
                    );
                }
            }
        } finally {
            try {
                reader.releaseLock();
            } catch {
                // ignored
            }
        }

        if (
            !res.destroyed
            && !res.writableEnded
        ) {
            res.end();
        }
    }

    private copyHeader(
        upstream: globalThis.Response,
        res: Response,
        header: string,
    ) {
        const value =
            upstream.headers.get(
                header,
            );

        if (value !== null) {
            res.setHeader(
                header,
                value,
            );
        }
    }
}