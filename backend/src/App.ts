import readConfig from "./helper/ConfigHelper";
import * as packageConfig from '../../package.json'
import {logRegular, logSuccess} from "./helper/LogHelper";
import TwitchClient from "./clients/twitch/Client";

let twitchClient: TwitchClient

void init()

async function init() {
    logSuccess(`Starting ${packageConfig.name} ${packageConfig.version} backend...`)

    logRegular('load config')
    readConfig()

    logRegular('connect twitch')
    twitchClient = new TwitchClient()
    await twitchClient.connect()
    await twitchClient.registerEvents()
}