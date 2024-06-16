import readConfig from "./helper/ConfigHelper";
import * as packageConfig from '../../package.json'
import {logRegular, logSuccess} from "./helper/LogHelper";
import TwitchClient from "./clients/twitch/Client";
import registerPermissions, {registerPermissionInterval} from "./clients/twitch/helper/PermissionHelper";
import WebsocketServer from "./clients/websocket/WebsocketServer";
import {fetchTheme} from "./helper/ThemeHelper";
import WebServer from "./clients/webserver/WebServer";
import {OBSClient} from "./clients/obs/OBSClient";

let twitchClient: TwitchClient
let websocketServer: WebsocketServer
let webServer: WebServer
let obsClient: OBSClient

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

    logRegular('connect obs')
    obsClient = new OBSClient()
    await obsClient.connect()
    logSuccess('obs client is ready')

    webServer = new WebServer()
    webServer.initial()

    await fetchTheme()

    logSuccess('backend is ready')
}

export default function getWebsocketServer() {
    return websocketServer
}

export function getTwitchClient() {
    return twitchClient
}

export function getWebServer() {
    return webServer
}

export function getOBSClient() {
    return obsClient
}