import { Request, Response } from "express";
import BaseApi from "../../abstracts/BaseApi";
import WebsocketServer from "../../clients/websocket/WebsocketServer";
import {logError, logRegular} from "../../helper/LogHelper";
import WebServer from "../../clients/webserver/WebServer";
import TwitchAuth from "../../clients/twitch/Auth";
import {setManagedConnection} from "../../helper/ConnectionHelper";
import {getTwitchClient} from "../../App";

export default class ConnectionAuthApi extends BaseApi {
    restEndpoint = null;
    restPost = false;
    websocketMethod = null;

    public constructor(websocketServer: WebsocketServer, restServer: WebServer) {
        super(websocketServer, restServer);
    }

    public registerEndpoints() {
        logRegular("register rest endpoint: /api/connection/auth");
        logRegular("register rest endpoint: /api/connection/callback/twitch");

        this.restExpress.get("/api/connection/auth", (req: Request, res: Response) => {
            const type = String(req.query.type ?? "").toLowerCase();

            if (type !== "twitch") {
                res.status(400).json({
                    data: {
                        error: true,
                        message: "invalid connection type",
                        allowed: ["twitch"]
                    },
                    status: 400
                });
                return;
            }

            try {
                const auth = new TwitchAuth();
                const callbackAddress = this.getCallbackAddress(req);
                const returnTo = this.getReturnTo(req);
                const authUrl = auth.buildConfiguredAuthUrl(callbackAddress, returnTo);

                setManagedConnection("twitch", {
                    enabled: true,
                    state: "auth_required",
                    connected: false,
                    message: "waiting for Twitch auth"
                });

                res.redirect(authUrl);
            } catch (error) {
                logError("failed to build Twitch auth url");
                logError(JSON.stringify(error, Object.getOwnPropertyNames(error)));

                res.status(500).json({
                    data: {
                        error: true,
                        message: "failed to build Twitch auth url"
                    },
                    status: 500
                });
            }
        });

        this.restExpress.get("/api/connection/callback/twitch", async (req: Request, res: Response) => {
            const auth = new TwitchAuth();
            const callbackAddress = this.getCallbackAddress(req);

            await auth.handleCallbackRequest(req, res, callbackAddress, async () => {
                setManagedConnection("twitch", {
                    enabled: true,
                    state: "connecting",
                    connected: false,
                    message: "auth complete, connecting"
                });

                try {
                    await getTwitchClient().connect();
                } catch (error) {
                    setManagedConnection("twitch", {
                        enabled: true,
                        state: "error",
                        connected: false,
                        message: "Twitch connection failed after auth"
                    });

                    logError("failed to connect Twitch after auth");
                    logError(JSON.stringify(error, Object.getOwnPropertyNames(error)));
                }
            });
        });
    }

    private getCallbackAddress(req: Request) {
        return `${this.getRequestOrigin(req)}/api/connection/callback/twitch`;
    }

    private getReturnTo(req: Request) {
        if (typeof req.query.returnTo === "string" && req.query.returnTo.length) {
            return req.query.returnTo;
        }

        return `${this.getRequestOrigin(req)}/commander/`;
    }

    private getRequestOrigin(req: Request) {
        const proto = String(req.headers["x-forwarded-proto"] ?? req.protocol ?? "http").split(",")[0].trim();
        const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost").split(",")[0].trim();

        return `${proto}://${host}`;
    }
}
