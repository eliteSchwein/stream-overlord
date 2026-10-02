import {RefreshingAuthProvider, StaticAuthProvider} from "@twurple/auth";
import {promises as fs} from "fs";
import {existsSync} from "node:fs";
import {Request, Response} from "express";
import axios from "axios";
import * as path from "node:path";
import {getConfig, getSystemConfigDirectory} from "../../helper/ConfigHelper";
import {logError, logRegular, logWarn} from "../../helper/LogHelper";

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

const DEFAULT_CLOUD_URL = "https://cloud.streamding.dev";

function firstString(...values: unknown[]) {
    for (const value of values) {
        if (typeof value !== "string") continue;
        const trimmed = value.trim();
        if (trimmed) return trimmed;
    }
    return "";
}

function trimTrailingSlash(value: string) {
    return value.replace(/\/+$/, "");
}

function env(name: string) {
    return String(process.env[name] ?? "").trim();
}

export default class TwitchAuth {
    private static integrationsWriteQueue: Promise<void> = Promise.resolve();

    protected integrationsPath = path.join(getSystemConfigDirectory(), "integrations.json");
    protected tempTokenData: TwitchTokenData | null = null;
    protected authProvider!: RefreshingAuthProvider | StaticAuthProvider;

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
        "moderator:manage:announcements",
        "user:read:chat",
        "user:write:chat",
        "user:manage:whispers",
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
        // Normal startup always uses the credentials already persisted locally.
        // The cloud is only the OAuth broker that creates/replaces these tokens.
        const tokenData = await this.getStoredToken(type);

        if (!tokenData?.accessToken) {
            if (required) {
                throw new Error(`Twitch ${type} auth is not configured in integrations.json`);
            }

            return null;
        }

        const enrichedTokenData = await this.ensureTokenUser(type, tokenData);
        const {clientId, clientSecret} = this.getConfiguredClient();

        const effectiveClientId = firstString(
            (enrichedTokenData as any).clientId,
            (enrichedTokenData as any).client_id,
            clientId,
        );

        if (!effectiveClientId) {
            throw new Error(`Twitch ${type} auth has no client_id`);
        }

        if (clientSecret) {
            const provider = new RefreshingAuthProvider({
                clientId: effectiveClientId,
                clientSecret,
            });

            provider.onRefresh(async (_clientId, newTokenData) => {
                await this.writeToken(type, {
                    ...(newTokenData as TwitchTokenData),
                    clientId: effectiveClientId,
                } as any);
            });

            await provider.addUserForToken(
                enrichedTokenData,
                this.getIntents(type),
                enrichedTokenData.userId,
            );

            this.authProvider = provider;
            return provider;
        }

        // New cloud-broker auth does not require a Twitch client secret locally.
        // StaticAuthProvider keeps the returned access token usable immediately.
        // Re-auth through the cloud broker replaces it when needed.
        const provider = new StaticAuthProvider(
            effectiveClientId,
            enrichedTokenData.accessToken,
            enrichedTokenData.scope ?? this.getScopes(type),
        );

        this.authProvider = provider;
        return provider;
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

        const temporaryPath = `${this.integrationsPath}.${process.pid}.${Date.now()}.tmp`;
        const content = JSON.stringify(data, null, 4);

        try {
            await fs.writeFile(temporaryPath, content, "utf8");
            await fs.rename(temporaryPath, this.integrationsPath);
        } catch (error) {
            await fs.rm(temporaryPath, {force: true}).catch(() => undefined);
            throw error;
        }
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
            clientId: data.clientId ?? data.client_id,
        } as TwitchTokenData;
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
        const updateToken = async () => {
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
        };

        const queuedUpdate = TwitchAuth.integrationsWriteQueue.then(updateToken, updateToken);
        TwitchAuth.integrationsWriteQueue = queuedUpdate.catch(() => undefined);
        await queuedUpdate;
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

    public getCloudConfig() {
        const cloud = getConfig(/cloud/g)[0] ?? {};
        const baseUrl = trimTrailingSlash(firstString(
            env("STREAMBOT_CLOUD_URL"),
            cloud.url,
            cloud.base_url,
            DEFAULT_CLOUD_URL,
        ));

        return {
            baseUrl,
            controlAuthUrl: firstString(
                env("STREAMBOT_CLOUD_TWITCH_AUTH_URL"),
                cloud.twitch_auth_url,
                cloud.control_auth_url,
                `${baseUrl}/auth/bot`,
            ),
            messageAuthUrl: firstString(
                env("STREAMBOT_CLOUD_TWITCH_MESSAGE_AUTH_URL"),
                cloud.twitch_message_auth_url,
                cloud.message_auth_url,
                `${baseUrl}/auth/message-bot`,
            ),
            exchangeUrl: firstString(
                env("STREAMBOT_CLOUD_TWITCH_EXCHANGE_URL"),
                cloud.twitch_exchange_url,
                cloud.exchange_url,
                `${baseUrl}/api/v1/twitch/exchange`,
            ),
        };
    }

    public buildCloudAuthUrl(
        callbackAddress: string,
        type: TwitchAuthType = "control",
    ) {
        const cloud = this.getCloudConfig();
        const url = new URL(
            type === "message" ? cloud.messageAuthUrl : cloud.controlAuthUrl,
        );

        // Current cloud backend expects return_url.
        url.searchParams.set("return_url", callbackAddress);

        return url.toString();
    }

    // Compatibility for the old WebServer.ts route and older callers.
    public buildConfiguredAuthUrl(
        callbackAddress: string,
        _returnTo: string,
        type: TwitchAuthType = "control",
    ) {
        return this.buildCloudAuthUrl(callbackAddress, type);
    }

    private callbackAuthType(req: Request): TwitchAuthType {
        if (req.query.type === "message") return "message";
        if (req.query.cloud_auth === "message" || req.query.cloud_auth === "message-bot") return "message";
        return "control";
    }

    private callbackCode(req: Request) {
        return firstString(
            req.query.code,
            req.query.exchange_code,
            req.query.auth_code,
        );
    }

    private normalizeExchangeToken(data: any): TwitchTokenData {
        const root = data?.data ?? data ?? {};
        const token = root?.token ?? root?.twitch ?? root;
        const accessToken = firstString(token.accessToken, token.access_token);
        const refreshToken = firstString(token.refreshToken, token.refresh_token);
        const clientId = firstString(token.clientId, token.client_id, root.clientId, root.client_id);

        if (!accessToken) {
            throw new Error("cloud Twitch exchange response is missing access_token");
        }

        if (!clientId) {
            throw new Error("cloud Twitch exchange response is missing client_id");
        }

        const scopes = Array.isArray(token.scope)
            ? token.scope.map(String)
            : Array.isArray(token.scopes)
                ? token.scopes.map(String)
                : typeof token.scope === "string"
                    ? token.scope.split(/\s+/).filter(Boolean)
                    : [];

        return {
            accessToken,
            refreshToken,
            expiresIn: Number(token.expiresIn ?? token.expires_in ?? 0),
            obtainmentTimestamp: Number(
                token.obtainmentTimestamp
                ?? token.obtainment_timestamp
                ?? root.obtainmentTimestamp
                ?? root.obtainment_timestamp
                ?? Date.now(),
            ),
            scope: scopes,
            userId: firstString(token.userId, token.user_id, root.userId, root.user_id) || undefined,
            login: firstString(token.login, root.login) || undefined,
            clientId,
        } as TwitchTokenData;
    }

    public async handleCallbackRequest(
        req: Request,
        res: Response,
        _callbackAddress: string,
        onSuccess?: () => Promise<void> | void,
    ) {
        const status = String(req.query.status ?? "success").toLowerCase();
        const error = firstString(req.query.error, req.query.error_description);

        if (status !== "success" || error) {
            res.status(400).send(`Twitch cloud auth failed: ${error || status}`);
            return;
        }

        const code = this.callbackCode(req);
        if (!code) {
            res.status(400).send("Twitch cloud auth callback did not contain an exchange code");
            return;
        }

        const type = this.callbackAuthType(req);
        const cloud = this.getCloudConfig();

        try {
            const response = await axios.post(
                cloud.exchangeUrl,
                {code},
                {
                    headers: {
                        "Content-Type": "application/json",
                    },
                    timeout: 10_000,
                },
            );

            const tokenData = this.normalizeExchangeToken(response.data);
            this.tempTokenData = tokenData;

            if (!tokenData.userId) {
                const user = await this.getTokenUser(tokenData.accessToken);
                tokenData.userId = user.userId;
                tokenData.login = tokenData.login ?? user.login;
            }

            await this.writeToken(type, tokenData);

            logRegular(
                `stored Twitch ${type} cloud auth in integrations.json `
                + `for ${tokenData.login ?? tokenData.userId ?? "unknown user"}`,
            );

            if (onSuccess) {
                try {
                    await onSuccess();
                } catch (hookError) {
                    logError(
                        `failed to run Twitch auth success hook: `
                        + JSON.stringify(hookError, Object.getOwnPropertyNames(hookError)),
                    );
                }
            }

            const returnTo = firstString(
                req.query.returnTo,
                req.query.return_to,
                req.query.return_url,
            );

            if (returnTo) {
                res.redirect(303, returnTo);
                return;
            }

            res.status(200).send(`Twitch ${type} auth successful. You can close this window.`);
        } catch (exchangeError) {
            logError("Twitch cloud auth exchange failed");
            logError(JSON.stringify(exchangeError, Object.getOwnPropertyNames(exchangeError)));
            res.status(500).send("Twitch cloud auth exchange failed");
        }
    }

}