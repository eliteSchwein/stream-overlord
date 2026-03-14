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
import { getWebServer, setUnreadyMessage } from "../../App";

export default class TwitchAuth {
    protected tokensPath = `${__dirname}/../../twitchTokens.json`;
    protected tempTokenData: any = null;
    protected authProvider!: RefreshingAuthProvider;

    /**
     * Full scope set: try this first.
     * This matches the broad scope request pattern already in your file.
     */
    protected readonly affiliateScopes = [
        "bits:read",
        "channel:bot",
        "channel:edit:commercial",
        "channel:manage:ads",
        "channel:manage:broadcast",
        "channel:manage:extensions",
        "channel:manage:moderators",
        "channel:manage:polls",
        "channel:manage:predictions",
        "channel:manage:raids",
        "channel:manage:redemptions",
        "channel:manage:schedule",
        "channel:manage:videos",
        "channel:manage:vips",
        "channel:moderate",
        "channel:read:ads",
        "channel:read:charity",
        "channel:read:editors",
        "channel:read:goals",
        "channel:read:hype_train",
        "channel:read:polls",
        "channel:read:predictions",
        "channel:read:redemptions",
        "channel:read:subscriptions",
        "channel:read:vips",
        "chat:edit",
        "chat:read",
        "clips:edit",
        "moderation:read",
        "moderator:manage:announcements",
        "moderator:manage:banned_users",
        "moderator:manage:chat_messages",
        "moderator:manage:chat_settings",
        "moderator:manage:shield_mode",
        "moderator:manage:shoutouts",
        "moderator:manage:unban_requests",
        "moderator:read:chat_settings",
        "moderator:read:chatters",
        "moderator:read:followers",
        "moderator:read:shield_mode",
        "moderator:read:shoutouts",
        "moderator:read:unban_requests",
        "user:bot",
        "user:edit",
        "user:edit:broadcast",
        "user:edit:follows",
        "user:manage:blocked_users",
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

    /**
     * Reduced scope set: use this if Twitch says the broadcaster
     * must have partner or affiliate status.
     */
    protected readonly nonAffiliateScopes = [
        "channel:bot",
        "channel:manage:broadcast",
        "channel:manage:extensions",
        "channel:manage:moderators",
        "channel:manage:polls",
        "channel:manage:raids",
        "channel:manage:schedule",
        "channel:manage:videos",
        "channel:manage:vips",
        "channel:moderate",
        "channel:read:editors",
        "channel:read:polls",
        "channel:read:vips",
        "chat:edit",
        "chat:read",
        "clips:edit",
        "moderation:read",
        "moderator:manage:announcements",
        "moderator:manage:banned_users",
        "moderator:manage:chat_messages",
        "moderator:manage:chat_settings",
        "moderator:manage:shield_mode",
        "moderator:manage:shoutouts",
        "moderator:manage:unban_requests",
        "moderator:read:chat_settings",
        "moderator:read:chatters",
        "moderator:read:followers",
        "moderator:read:shield_mode",
        "moderator:read:shoutouts",
        "moderator:read:unban_requests",
        "user:bot",
        "user:edit",
        "user:edit:broadcast",
        "user:edit:follows",
        "user:manage:blocked_users",
        "user:manage:whispers",
        "user:read:blocked_users",
        "user:read:broadcast",
        "user:read:chat",
        "user:read:email",
        "user:read:emotes",
        "user:read:follows",
        "user:read:moderated_channels",
        "user:write:chat",
        "whispers:edit",
        "whispers:read"
    ];

    /**
     * The scope set currently used by the OAuth web flow.
     * Starts with the full/affiliate-capable set.
     */
    protected currentScopes = [...this.affiliateScopes];

    private getIntents(scopes: string[]) {
        return [...scopes, "chat"];
    }

    private createAuthProvider(clientId: string, clientSecret: string) {
        const authProvider = new RefreshingAuthProvider({ clientId, clientSecret });

        authProvider.onRefresh(async (_clientId, newTokenData) => {
            await fs.writeFile(this.tokensPath, JSON.stringify(newTokenData, null, 4), 'utf-8');
        });

        return authProvider;
    }

    private isAffiliateOnlyError(error: unknown): boolean {
        const message =
            axios.isAxiosError(error)
                ? `${error.response?.data?.message ?? ""} ${error.message ?? ""}`
                : error instanceof Error
                    ? error.message
                    : String(error);

        return /partner or affiliate status/i.test(message);
    }

    private formatError(error: unknown): string {
        if (axios.isAxiosError(error)) {
            return JSON.stringify({
                status: error.response?.status,
                data: error.response?.data,
                message: error.message
            }, null, 4);
        }

        if (error instanceof Error) {
            return JSON.stringify({
                message: error.message,
                stack: error.stack
            }, null, 4);
        }

        return JSON.stringify(error, null, 4);
    }

    private async deleteStoredTokenIfExists() {
        if (existsSync(this.tokensPath)) {
            await fs.unlink(this.tokensPath);
        }
    }

    private async initWithScopes(
        clientId: string,
        clientSecret: string,
        scopes: string[],
        forceReauth = false
    ) {
        this.currentScopes = [...scopes];

        if (forceReauth) {
            this.tempTokenData = null;
            await this.deleteStoredTokenIfExists();
        }

        const tokenData = await this.readTokenFile(clientId, clientSecret);
        const authProvider = this.createAuthProvider(clientId, clientSecret);

        await authProvider.addUserForToken(tokenData, this.getIntents(scopes));

        this.authProvider = authProvider;
        return authProvider;
    }

    public async getAuthCode() {
        const config = getConfig(/twitch/g)[0];
        const clientId = config['client_id'];
        const clientSecret = config['client_secret'];

        try {
            return await this.initWithScopes(clientId, clientSecret, this.affiliateScopes);
        } catch (error) {
            if (!this.isAffiliateOnlyError(error)) {
                logError(`Twitch auth error: ${this.formatError(error)}`);
                throw error;
            }

            logWarn("Twitch rejected affiliate/partner-only scopes. Falling back to non-affiliate scopes.");
            logWarn("Stored Twitch token will be replaced. Please complete the browser auth again.");

            try {
                return await this.initWithScopes(clientId, clientSecret, this.nonAffiliateScopes, true);
            } catch (fallbackError) {
                logError(`Fallback Twitch auth error: ${this.formatError(fallbackError)}`);
                throw fallbackError;
            }
        }
    }

    public getAuthProvider() {
        return this.authProvider;
    }

    private async readTokenFile(clientId: string, clientSecret: string) {
        if (!existsSync(this.tokensPath)) {
            this.tempTokenData = null;
            await this.startAuthapp(clientId, clientSecret);
            await waitUntil(() => this.tempTokenData !== null, { timeout: WAIT_FOREVER });
            await fs.writeFile(this.tokensPath, JSON.stringify(this.tempTokenData, null, 4), 'utf-8');
            return this.tempTokenData;
        }

        const tokenData = await fs.readFile(this.tokensPath, "utf8");
        return JSON.parse(tokenData);
    }

    private buildAuthUrl(clientId: string, callbackAddress: string, originPath: string) {
        const statePayload = {
            origin: originPath,
            nonce: crypto.randomBytes(16).toString("hex"),
        };

        const state = Buffer.from(JSON.stringify(statePayload)).toString("base64url");

        const url = new URL("https://id.twitch.tv/oauth2/authorize");
        url.searchParams.set("client_id", clientId);
        url.searchParams.set("redirect_uri", callbackAddress);
        url.searchParams.set("response_type", "code");
        url.searchParams.set("scope", this.currentScopes.join(" "));
        url.searchParams.set("state", state);

        return url.toString();
    }

    private safeOriginFromState(state: unknown): string {
        if (typeof state !== "string" || !state.length) return "/";

        try {
            const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
            const origin = decoded?.origin;

            if (typeof origin === "string" && origin.startsWith("/")) return origin;
            return "/";
        } catch {
            return "/";
        }
    }

    private async startAuthapp(clientId: string, clientSecret: string) {
        const config = getConfig(/webserver/g)[0];
        const address = 'localhost';
        const port = config.port;
        const app = express();

        const hostAddress = `http://${address}:${port}`;
        const authAddress = `${hostAddress}/`;
        const callbackAddress = `${hostAddress}/callback`;

        logEmpty();
        logWarn(`please configure ${callbackAddress} in your twitch application`);
        logWarn(`requesting scopes: ${this.currentScopes.join(", ")}`);
        logEmpty();

        setUnreadyMessage('auth in progress');

        getWebServer().getExpressServer().close();

        const server = app.listen(port, () => {
            logRegular(`please open ${authAddress} in your web browser`);
        });

        app.get("/", (_req: Request, res: Response) => {
            res.redirect(this.buildAuthUrl(clientId, callbackAddress, "/"));
        });

        app.get(/^\/commander(?:\/.*)?$/, (req: Request, res: Response) => {
            res.redirect(this.buildAuthUrl(clientId, callbackAddress, req.originalUrl));
        });

        app.get('/config.json', (_req, res) => {
            res.json(getConfig());
        });

        app.get("/callback", async (req: Request, res: Response) => {
            const code = req.query.code as string | undefined;
            const state = req.query.state;
            const error = req.query.error as string | undefined;
            const errorDescription = req.query.error_description as string | undefined;
            const origin = this.safeOriginFromState(state);

            if (!code) {
                logError(
                    `OAuth callback without code. ` +
                    `error=${error ?? "none"} ` +
                    `error_description=${errorDescription ?? "none"}`
                );

                res.status(400).send(`
# OAuth failed

error: ${error ?? "(none)"}

description: ${errorDescription ?? "(none)"}

<a href="${origin}">Back</a>
`);
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
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
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

                setUnreadyMessage('backend loading');

                res.on("finish", async () => {
                    server.close(async () => {
                        try {
                            await getWebServer().initial();
                            logSuccess("twitch auth successfully!");
                        } catch (restartError) {
                            logError(`Failed to restart normal server: ${this.formatError(restartError)}`);
                        }
                    });
                });

                res.status(200).send(`
Auth successful

Auth successful. Restarting server...

If you are not redirected, <a href="${origin}">click here</a>.
`);
            } catch (callbackError) {
                logError(`Auth callback error: ${this.formatError(callbackError)}`);
                res.status(500).send('Auth Error!');
            }
        });
    }
}
