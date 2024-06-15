import readConfig from "./helper/ConfigHelper";
import * as packageConfig from '../../package.json'
import {logRegular, logSuccess} from "./helper/LogHelper";
import TwitchClient from "./clients/twitch/Client";
import registerPermissions, {registerPermissionInterval} from "./clients/twitch/helper/PermissionHelper";
import WebsocketServer from "./clients/websocket/WebsocketServer";

let twitchClient: TwitchClient
let websocketServer: WebsocketServer

void init()

async function init() {
    logSuccess(`Starting ${packageConfig.name} ${packageConfig.version} backend...`)

    logRegular('load config')
    readConfig()

    logRegular('connect twitch')
    twitchClient = new TwitchClient()
    await twitchClient.connect()
    await twitchClient.registerEvents()
    await registerPermissions(twitchClient.getBot())
    registerPermissionInterval(twitchClient.getBot())
    logSuccess('twitch client is ready')

    websocketServer = new WebsocketServer()
    websocketServer.initial()
    websocketServer.registerEvents()
    logSuccess('websocket server is ready')

    logSuccess('backend is ready')
}

export default function getWebsocketServer() {
    return websocketServer
}

export function getTwitchClient() {
    return twitchClient
}