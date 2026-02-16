import { RefreshingAuthProvider } from '@twurple/auth';
import { promises as fs } from 'fs';
import { getConfig } from "../../helper/ConfigHelper";
import { existsSync } from "node:fs";
import { WAIT_FOREVER, waitUntil } from "async-wait-until";
import express, { Request, Response } from 'express';
import { logEmpty, logError, logRegular, logSuccess, logWarn } from "../../helper/LogHelper";
import axios from "axios";
import * as querystring from "node:querystring";
import crypto from "crypto";
import http from "http";
import {getWebServer, setUnreadyMessage} from "../../App";

export default class TwitchAuth {
    protected tokensPath = `${__dirname}/../../twitchTokens.json`;
    protected tempTokenData: any = null;
    protected authProvider!: RefreshingAuthProvider;

    protected scopes = [
        "user:bot",
        "user:edit",
        "user:edit:broadcast",
        "user:edit:follows",
        "user:manage:blocked_users",
        "user:manage:chat_color",
        "user:manage:whispers",
        "user:read:blocked_users",
        "user:read:broadcast",
        "user:read:chat",
        "user:read:email",
        "user:read:emotes",
        "user:read:follows",
        "user:read:moderated_channels",
        "user:read:subscriptions",
        "user:write:chat",
        "whispers:edit",
        "whispers:read"
    ];

    protected intends = this.scopes.concat(['chat']);

    public async getAuthCode() {
        const config = getConfig(/twitch/g)[0];
        const clientId = config['client_id'];
        const clientSecret = config['client_secret'];

        const tokenData = await this.readTokenFile(clientId, clientSecret);

        this.authProvider = new RefreshingAuthProvider({ clientId, clientSecret });
        this.authProvider.onRefresh(async (_clientId, newTokenData) => {
            await fs.writeFile(this.tokensPath, JSON.stringify(newTokenData, null, 4), 'utf-8');
        });

        await this.authProvider.addUserForToken(tokenData, this.intends);
        return this.authProvider;
    }

    public getAuthProvider() {
        return this.authProvider;
    }

    private async readTokenFile(clientId: string, clientSecret: string) {
        if (!existsSync(this.tokensPath)) {
            await this.startAuthapp(clientId, clientSecret);

            await waitUntil(() => this.tempTokenData !== null, {
                timeout: WAIT_FOREVER
            });

            await fs.writeFile(this.tokensPath, JSON.stringify(this.tempTokenData, null, 4), 'utf-8');
            return this.tempTokenData;
        }

        const tokenData = await fs.readFile(this.tokensPath, "utf8");
        return JSON.parse(tokenData);
    }

    private buildAuthUrl(clientId: string, callbackAddress: string, originPath: string) {
        const statePayload = {
            origin: originPath, // "/commander" or "/"
            nonce: crypto.randomBytes(16).toString("hex"),
        };

        const state = Buffer.from(JSON.stringify(statePayload)).toString("base64url");

        const url = new URL("https://id.twitch.tv/oauth2/authorize");
        url.searchParams.set("client_id", clientId);
        url.searchParams.set("redirect_uri", callbackAddress);
        url.searchParams.set("response_type", "code");
        url.searchParams.set("scope", this.scopes.join(" ")); // space-separated is standard
        url.searchParams.set("state", state);
        url.searchParams.set("force_verify", "true");

        return url.toString();
    }

    private safeOriginFromState(state: unknown): string {
        if (typeof state !== "string" || !state.length) return "/";

        try {
            const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
            const origin = decoded?.origin;

            // Prevent open redirects: only allow local relative paths
            if (typeof origin === "string" && origin.startsWith("/")) return origin;
            return "/";
        } catch {
            return "/";
        }
    }

    private async startAuthapp(clientId: string, clientSecret: string) {
        const config = getConfig(/webserver/g)[0];
        const address = '127.0.0.1';
        const port = config.port;
        const app = express()

        const hostAddress = `http://${address}:${port}`;
        const authAddress = `${hostAddress}/`;
        const callbackAddress = `${hostAddress}/callback`;

        logEmpty();
        logWarn(`please configure ${callbackAddress} in your twitch application`);
        logEmpty();

        setUnreadyMessage('auth in progress')

        /**
         * IMPORTANT:
         * Use ONE express app. Right now your code creates `const app = express()`
         * but then uses `getWebServer().getExpress()` for routes/close.
         *
         * Pick ONE. Below I use your existing web server if available,
         * otherwise create a local one.
         */

        getWebServer().getExpressServer().close()

        const server = app.listen(port, () => {
            logRegular(`please open ${authAddress} in your web browser`)
        });

        // Build auth redirects that remember the route
        app.get("/", (req: Request, res: Response) => {
            res.redirect(this.buildAuthUrl(clientId, callbackAddress, "/"));
        })

        app.get(/^\/commander(?:\/.*)?$/, (req: Request, res: Response) => {
            res.redirect(this.buildAuthUrl(clientId, callbackAddress, req.originalUrl));
        })

        app.get('/config.json',
            (req, res) => {
                res.json(getConfig())
            })

        app.get("/callback", async (req: Request, res: Response) => {
            const code = req.query.code as string | undefined;
            const state = req.query.state;

            const origin = this.safeOriginFromState(state);

            if (!code) {
                res.status(400).send("Missing code");
                return;
            }

            const params: any = {
                client_id: clientId,
                client_secret: clientSecret,
                code,
                grant_type: 'authorization_code',
                redirect_uri: callbackAddress
            };

            try {
                const response = await axios.post(
                    'https://id.twitch.tv/oauth2/token',
                    querystring.stringify(params),
                    {
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                    }
                );

                this.tempTokenData = response.data;

                this.tempTokenData['obtainmentTimestamp'] = Date.now();
                this.tempTokenData['expiresIn'] = this.tempTokenData['expires_in'];
                this.tempTokenData['accessToken'] = this.tempTokenData['access_token'];
                this.tempTokenData['refreshToken'] = this.tempTokenData['refresh_token'];

                delete this.tempTokenData['token_type'];
                delete this.tempTokenData['expires_in'];
                delete this.tempTokenData['access_token'];
                delete this.tempTokenData['refresh_token'];

                setUnreadyMessage('backend loading')

                res.on("finish", async () => {
                    // 1) close the auth server
                    server.close(async () => {
                        try {
                            await getWebServer().initial();
                            logSuccess("twitch auth successfully!");
                        } catch (e) {
                            logError(`Failed to restart normal server: ${JSON.stringify(e, null, 2)}`);
                        }
                    });
                });

                res.status(200).send(`
                  <html>
                    <head>
                      <meta charset="utf-8" />
                      <meta http-equiv="refresh" content="1;url=${origin}" />
                      <title>Auth successful</title>
                    </head>
                    <body>
                      <p>Auth successful. Restarting server…</p>
                      <p>If you are not redirected, <a href="${origin}">click here</a>.</p>
                      <script>
                        // Backup redirect in case meta-refresh is blocked
                        setTimeout(function () {
                          window.location.assign(${JSON.stringify(origin)});
                        }, 1000);
                      </script>
                    </body>
                  </html>
                `);
            } catch (error) {
                logError(`Auth Error: ${JSON.stringify(error, null, 4)}`);
                res.status(500).send('Auth Error!');
            }
        });
    }
}
