import {RefreshingAuthProvider} from "@twurple/auth";
import {promises as fs} from "fs";
import {existsSync} from "node:fs";
import express, {Request, Response} from "express";
import axios from "axios";
import * as querystring from "node:querystring";
import crypto from "crypto";
import * as path from "node:path";
import {WAIT_FOREVER, waitUntil} from "async-wait-until";
import {getConfig, getSystemConfigDirectory} from "../../helper/ConfigHelper";
import {logEmpty, logError, logRegular, logSuccess, logWarn} from "../../helper/LogHelper";
import {getWebServer, setUnreadyMessage} from "../../App";

export type TwitchAuthType = "control" | "message";

type TwitchTokenData = {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    obtainmentTimestamp: number;
    scope?: string[];
    userId?: string;
    login?: string;
};

type TwitchIntegration = {
    client_id?: string;
    client_secret?: string;
    clientId?: string;
    clientSecret?: string;
    control?: TwitchTokenData;
    message?: TwitchTokenData;
};

type IntegrationsFile = {
    twitch?: TwitchIntegration;
    [key: string]: any;
};

export default class TwitchAuth {
    protected integrationsPath = path.join(getSystemConfigDirectory(), "integrations.json");
    protected tempTokenData: TwitchTokenData | null = null;
    protected authProvider!: RefreshingAuthProvider;

    protected readonly controlScopes = [
        "bits:read",
        "channel:bot",
        "channel:edit:commercial",
        "channel:manage:ads",
        "channel:manage:broadcast",
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
        "moderator:read:chat_settings",
        "moderator:read:chatters",
        "moderator:read:followers",
        "moderator:read:shield_mode",
        "moderator:read:shoutouts",
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
        "whispers:read",
    ];

    protected readonly messageScopes = [
        "chat:read",
        "chat:edit",
        "user:read:chat",
        "user:write:chat",
    ];

    protected getScopes(type: TwitchAuthType) {
        return type === "message" ? this.messageScopes : this.controlScopes;
    }

    protected getIntents(type: TwitchAuthType) {
        return this.getScopes(type).concat(["chat"]);
    }

    public hasToken(type: TwitchAuthType = "control"): boolean {
        const integrations = this.readIntegrationsSync();
        return !!integrations.twitch?.[type];
    }

    public async getStoredToken(type: TwitchAuthType = "control") {
        const integrations = await this.readIntegrations();
        const token = integrations.twitch?.[type];
        return token ? this.normalizeStoredTokenData(token) : null;
    }

    public async getAuthCode(required = false, type: TwitchAuthType = "control") {
        const {clientId, clientSecret} = this.getConfiguredClient();

        if (!clientId || !clientSecret) {
            if (required) throw new Error("missing twitch client_id/client_secret");
            logWarn("twitch auth skipped: missing client_id/client_secret");
            return null;
        }

        if (!required && !this.hasToken(type)) {
            logWarn(`twitch ${type} auth skipped: token is missing`);
            return null;
        }

        const tokenData = await this.readToken(clientId, clientSecret, required, type);
        if (!tokenData) return null;

        const enrichedTokenData = await this.ensureTokenUser(type, tokenData);

        this.authProvider = new RefreshingAuthProvider({clientId, clientSecret});

        this.authProvider.onRefresh(async (_clientId, newTokenData) => {
            await this.writeToken(type, newTokenData as TwitchTokenData);
        });

        await this.authProvider.addUserForToken(
            enrichedTokenData,
            this.getIntents(type),
            enrichedTokenData.userId
        );
        return this.authProvider;
    }

    public getAuthProvider() {
        return this.authProvider;
    }

    private async readToken(
        clientId: string,
        clientSecret: string,
        required: boolean,
        type: TwitchAuthType
    ) {
        const integrations = await this.readIntegrations();
        const token = integrations.twitch?.[type];

        if (token) return this.normalizeStoredTokenData(token);

        if (!required) return null;

        await this.startAuthapp(clientId, clientSecret, type);
        await waitUntil(() => this.tempTokenData !== null, {timeout: WAIT_FOREVER});

        await this.writeToken(type, this.tempTokenData!);
        return this.tempTokenData;
    }

    private async readIntegrations(): Promise<IntegrationsFile> {
        if (!existsSync(this.integrationsPath)) return {};

        try {
            return JSON.parse(await fs.readFile(this.integrationsPath, "utf8"));
        } catch {
            return {};
        }
    }

    private readIntegrationsSync(): IntegrationsFile {
        if (!existsSync(this.integrationsPath)) return {};

        try {
            return JSON.parse(require("node:fs").readFileSync(this.integrationsPath, "utf8"));
        } catch {
            return {};
        }
    }

    private async writeIntegrations(data: IntegrationsFile) {
        await fs.mkdir(path.dirname(this.integrationsPath), {recursive: true});
        await fs.writeFile(this.integrationsPath, JSON.stringify(data, null, 4), "utf8");
    }

    private normalizeStoredTokenData(data: any): TwitchTokenData {
        return {
            ...data,
            accessToken: data.accessToken ?? data["access_token"],
            refreshToken: data.refreshToken ?? data["refresh_token"],
            expiresIn: data.expiresIn ?? data["expires_in"],
            obtainmentTimestamp: data.obtainmentTimestamp ?? Date.now(),
            scope: data.scope,
            userId: data.userId ?? data.user_id,
            login: data.login,
        };
    }

    private async ensureTokenUser(type: TwitchAuthType, tokenData: TwitchTokenData): Promise<TwitchTokenData> {
        const normalized = this.normalizeStoredTokenData(tokenData);

        if (normalized.userId) {
            return normalized;
        }

        const tokenUser = await this.getTokenUser(normalized.accessToken);
        normalized.userId = tokenUser.userId;
        normalized.login = tokenUser.login;

        await this.writeToken(type, normalized);
        return normalized;
    }

    private async writeToken(type: TwitchAuthType, tokenData: TwitchTokenData) {
        const integrations = await this.readIntegrations();
        const oldToken = integrations.twitch?.[type];
        const normalized = this.normalizeStoredTokenData(tokenData);

        integrations.twitch ??= {};
        integrations.twitch[type] = {
            ...normalized,
            userId: normalized.userId ?? oldToken?.userId,
            login: normalized.login ?? oldToken?.login,
        };

        await this.writeIntegrations(integrations);
    }

    public getConfiguredClient() {
        const config = getConfig(/twitch/g)[0];
        const integrations = this.readIntegrationsSync();
        const twitch = integrations.twitch ?? {};

        return {
            clientId: twitch.client_id ?? twitch.clientId ?? config?.["client_id"],
            clientSecret: twitch.client_secret ?? twitch.clientSecret ?? config?.["client_secret"],
        };
    }

    public buildAuthUrl(
        clientId: string,
        callbackAddress: string,
        returnTo: string,
        type: TwitchAuthType = "control"
    ) {
        const statePayload = {
            returnTo,
            type,
            nonce: crypto.randomBytes(16).toString("hex"),
        };

        const state = Buffer.from(JSON.stringify(statePayload)).toString("base64url");

        const url = new URL("https://id.twitch.tv/oauth2/authorize");
        url.searchParams.set("client_id", clientId);
        url.searchParams.set("redirect_uri", callbackAddress);
        url.searchParams.set("response_type", "code");
        url.searchParams.set("scope", this.getScopes(type).join(" "));
        url.searchParams.set("state", state);

        return url.toString();
    }

    public buildConfiguredAuthUrl(callbackAddress: string, returnTo: string, type: TwitchAuthType = "control") {
        const {clientId, clientSecret} = this.getConfiguredClient();

        if (!clientId || !clientSecret) {
            throw new Error("missing twitch client_id/client_secret");
        }

        return this.buildAuthUrl(clientId, callbackAddress, returnTo, type);
    }

    private safeState(state: unknown): { returnTo: string; type: TwitchAuthType } {
        const fallback = {
            returnTo: "http://localhost:8105/commander/",
            type: "control" as TwitchAuthType,
        };

        if (typeof state !== "string" || !state.length) return fallback;

        try {
            const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));

            return {
                returnTo: typeof decoded?.returnTo === "string" && decoded.returnTo.length
                    ? new URL(decoded.returnTo).toString()
                    : fallback.returnTo,
                type: decoded?.type === "message" ? "message" : "control",
            };
        } catch {
            return fallback;
        }
    }

    private async getTokenUser(accessToken: string) {
        const response = await axios.get("https://id.twitch.tv/oauth2/validate", {
            headers: {
                Authorization: `OAuth ${accessToken}`,
            },
        });

        return {
            userId: response.data.user_id,
            login: response.data.login,
        };
    }

    private normalizeTokenData(data: any): TwitchTokenData {
        return {
            ...data,
            obtainmentTimestamp: Date.now(),
            expiresIn: data["expires_in"],
            accessToken: data["access_token"],
            refreshToken: data["refresh_token"],
        };
    }

    public async handleCallbackRequest(
        req: Request,
        res: Response,
        callbackAddress: string,
        onSuccess?: () => Promise<void> | void
    ) {
        const {clientId, clientSecret} = this.getConfiguredClient();

        if (!clientId || !clientSecret) {
            res.status(500).send("Twitch auth is not configured!");
            return;
        }

        const code = req.query.code as string | undefined;
        const error = req.query.error as string | undefined;
        const errorDescription = req.query.error_description as string | undefined;
        const state = this.safeState(req.query.state);
        const type = (req.query.type === "message" || req.query.type === "control")
            ? req.query.type as TwitchAuthType
            : state.type;

        if (!code) {
            logError(`OAuth callback without code. error=${error ?? "none"} error_description=${errorDescription ?? "none"}`);
            res.status(400).send(`OAuth failed: ${errorDescription ?? error ?? "unknown error"}`);
            return;
        }

        try {
            const response = await axios.post(
                "https://id.twitch.tv/oauth2/token",
                querystring.stringify({
                    client_id: clientId,
                    client_secret: clientSecret,
                    code,
                    grant_type: "authorization_code",
                    redirect_uri: callbackAddress,
                }),
                {
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                }
            );

            this.tempTokenData = this.normalizeTokenData(response.data);

            const tokenUser = await this.getTokenUser(this.tempTokenData.accessToken);

            this.tempTokenData.userId = tokenUser.userId;
            this.tempTokenData.login = tokenUser.login;

            await this.writeToken(type, this.tempTokenData);

            res.on("finish", async () => {
                if (!onSuccess) return;

                try {
                    await onSuccess();
                } catch (e) {
                    logError(`Failed to run Twitch auth success hook: ${JSON.stringify(e, null, 2)}`);
                }
            });

            res.status(200).send(`
<!doctype html>
<html>
<body>
<p>Twitch ${type} auth successful. Returning to app…</p>
<script>window.location.replace(${JSON.stringify(state.returnTo)});</script>
</body>
</html>
`);
        } catch (error) {
            logError(`Auth Error: ${JSON.stringify(error, null, 4)}`);
            res.status(500).send("Auth Error!");
        }
    }

    private async startAuthapp(clientId: string, clientSecret: string, type: TwitchAuthType) {
        const config = getConfig(/webserver/g)[0];
        const address = "localhost";
        const port = config.port;
        const app = express();

        const hostAddress = `http://${address}:${port}`;
        const callbackAddress = `${hostAddress}/api/auth/twitch`;
        const authAddress = `${hostAddress}/api/auth/twitch?type=${type}`;

        logEmpty();
        logWarn(`please configure ${callbackAddress} in your twitch application`);
        logEmpty();

        setUnreadyMessage("auth in progress");
        getWebServer().getExpressServer().close();

        const server = app.listen(port, () => {
            logRegular(`please open ${authAddress} in your web browser`);
        });

        app.get("/api/auth/twitch", async (req: Request, res: Response) => {
            const requestedType = req.query.type === "message" ? "message" : type;

            if (!req.query.code) {
                const returnTo = typeof req.query.returnTo === "string" && req.query.returnTo.length
                    ? req.query.returnTo
                    : "http://localhost:1420/";

                res.redirect(this.buildAuthUrl(clientId, callbackAddress, returnTo, requestedType));
                return;
            }

            await this.handleCallbackRequest(req, res, callbackAddress, async () => {
                setUnreadyMessage("backend loading");

                server.close(async () => {
                    try {
                        await getWebServer().initial();
                        logSuccess(`twitch ${requestedType} auth successfully!`);
                    } catch (e) {
                        logError(`Failed to restart normal server: ${JSON.stringify(e, null, 2)}`);
                    }
                });
            });
        });
    }
}