import TwitchAuth from "./Auth";
import {getConfig} from "../../helper/ConfigHelper";

export default class TwitchClient {
    protected auth: TwitchAuth

    public async connect() {
        this.auth = new TwitchAuth()

        const config = getConfig()['twitch']

        const authProvider = await this.auth.getAuthCode()
    }
}