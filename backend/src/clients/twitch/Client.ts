import TwitchAuth from "./Auth";

export default class TwitchClient {
    protected auth: TwitchAuth
    public async connect() {
        this.auth = new TwitchAuth()

        const authCode = await this.auth.getAuthCode()
    }
}