import {RefreshingAuthProvider} from '@twurple/auth';
import {promises as fs} from 'fs';
import {getConfig} from "../../helper/ConfigHelper";
import {existsSync} from "node:fs";
import {WAIT_FOREVER, waitUntil} from "async-wait-until";
import express, { Request, Response } from 'express';
import {logEmpty, logError, logRegular, logSuccess, logWarn} from "../../helper/LogHelper";
import axios from "axios";
import * as querystring from "node:querystring";

export default class TwitchAuth {
    protected tokensPath = `${__dirname}/../../twitchTokens.json`
    protected tempTokenData: any = null
    protected authProvider: RefreshingAuthProvider
    protected scopes = [
        "analytics:read:extensions",
        "analytics:read:games",
        "bits:read",
        "channel:bot",
        "channel:edit:commercial",
        "channel:manage:ads",
        "channel:manage:broadcast",
        "channel:manage:extensions",
        "channel:manage:guest_star",
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
        "channel:read:guest_star",
        "channel:read:hype_train",
        "channel:read:polls",
        "channel:read:predictions",
        "channel:read:redemptions",
        "channel:read:stream_key",
        "channel:read:subscriptions",
        "channel:read:vips",
        "chat:edit",
        "chat:read",
        "clips:edit",
        "moderation:read",
        "moderator:manage:announcements",
        "moderator:manage:automod",
        "moderator:manage:automod_settings",
        "moderator:manage:banned_users",
        "moderator:manage:blocked_terms",
        "moderator:manage:chat_messages",
        "moderator:manage:chat_settings",
        "moderator:manage:guest_star",
        "moderator:manage:shield_mode",
        "moderator:manage:shoutouts",
        "moderator:manage:unban_requests",
        "moderator:read:automod_settings",
        "moderator:read:blocked_terms",
        "moderator:read:chat_settings",
        "moderator:read:chatters",
        "moderator:read:followers",
        "moderator:read:guest_star",
        "moderator:read:shield_mode",
        "moderator:read:shoutouts",
        "moderator:read:unban_requests",
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
    ]
    protected intends = this.scopes.concat([
        'chat'
    ])

    public async getAuthCode() {
        const config = getConfig(/twitch/g)[0]
        const clientId = config['client_id'];
        const clientSecret = config['client_secret'];
        const tokenData = await this.readTokenFile(clientId, clientSecret)

        this.authProvider = new RefreshingAuthProvider(
            {
                clientId,
                clientSecret
            }
        );

        this.authProvider.onRefresh(async (clientId, newTokenData) => await fs.writeFile(this.tokensPath, JSON.stringify(newTokenData), 'utf-8'));

        await this.authProvider.addUserForToken(tokenData, this.intends);

        return this.authProvider
    }

    public getAuthProvider() {
        return this.authProvider
    }

    private async readTokenFile(clientId: string, clientSecret: string) {
        if(!existsSync(this.tokensPath)) {
            this.startAuthapp(clientId, clientSecret)
            await waitUntil(() => this.tempTokenData !== null, {
                timeout: WAIT_FOREVER
            })
            await fs.writeFile(this.tokensPath, JSON.stringify(this.tempTokenData, null, 4), 'utf-8')

            return this.tempTokenData
        }

        const tokenData = await fs.readFile(this.tokensPath, "utf8")

        return JSON.parse(tokenData)
    }

    private startAuthapp(clientId: string, clientSecret: string) {
        const address = 'localhost'
        const port = 3699
        const app = express()

        const hostAddress = `http://${address}:${port}`
        const authAddress = `${hostAddress}/`
        const callbackAddress = `${hostAddress}/callback`

        logEmpty()
        logWarn(`please configure ${callbackAddress} in your twitch application`)
        logEmpty()

        const server = app.listen(port, () => {
            logRegular(`please open ${authAddress} in your web browser`)
        });

        app.get('/', (req: Request, res: Response) => {
            res.redirect(`https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${callbackAddress}&response_type=code&scope=${this.scopes.join('+')}`);
        });

        app.get('/callback', async (req: Request, res: Response) => {
            const { code } = req.query;

            const params: any = {
                client_id: clientId,
                client_secret: clientSecret,
                code,
                grant_type: 'authorization_code',
                redirect_uri: callbackAddress
            };

            try {
                const response = await axios.post('https://id.twitch.tv/oauth2/token', querystring.stringify(params), {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                });

                this.tempTokenData = response.data

                this.tempTokenData['obtainmentTimestamp'] = Date.now()
                this.tempTokenData['expiresIn'] = this.tempTokenData['expires_in']
                this.tempTokenData['accessToken'] = this.tempTokenData['access_token']
                this.tempTokenData['refreshToken'] = this.tempTokenData['refresh_token']

                //delete this.tempTokenData['scope']
                delete this.tempTokenData['token_type']
                delete this.tempTokenData['expires_in']
                delete this.tempTokenData['access_token']
                delete this.tempTokenData['refresh_token']

                res.send('Auth successfully!');

                server.close()

                logSuccess('twitch auth successfully!');
            } catch (error) {
                logError(`Auth Error: ${JSON.stringify(error, null, 4)}`)
                res.status(500).send('Auth Error!');
            }
        });
    }
}