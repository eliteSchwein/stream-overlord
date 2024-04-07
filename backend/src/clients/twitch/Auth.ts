import { RefreshingAuthProvider } from '@twurple/auth';
import { promises as fs } from 'fs';
import {getConfig} from "../../helper/ConfigHelper";
import {existsSync} from "node:fs";

export default class TwitchAuth {
    protected tokensPath = `${__dirname}/../../twitchTokens.json`
    protected defaultToken = {
        "accessToken": "",
        "refreshToken": "",
        "expiresIn": 0,
        "obtainmentTimestamp": 0
    }
    protected authProvider: RefreshingAuthProvider

    public async getAuthCode() {
        const config = getConfig()['twitch']
        const clientId = config['client_id'];
        const clientSecret = config['client_secret'];
        const tokenData = await this.readTokenFile()
        this.authProvider = new RefreshingAuthProvider(
            {
                clientId,
                clientSecret
            }
        );

        this.authProvider.onRefresh(async (userId, newTokenData) => await fs.writeFile(this.tokensPath, JSON.stringify(newTokenData), 'utf-8'));

        await this.authProvider.addUserForToken(tokenData);

        return this.authProvider
    }

    public getAuthProvider() {
        return this.authProvider
    }

    private async readTokenFile() {
        if(!existsSync(this.tokensPath)) {
            await fs.writeFile(this.tokensPath, JSON.stringify(this.defaultToken), 'utf-8')

            return this.defaultToken
        }

        const tokenData = await fs.readFile(this.tokensPath, "utf8")

        return JSON.parse(tokenData)
    }
}