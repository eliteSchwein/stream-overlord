import readConfig, {getConfig} from "./helper/ConfigHelper";
import * as packageConfig from '../../package.json'
import {logRegular, logSuccess, logWarn} from "./helper/LogHelper";
import TwitchClient from "./clients/twitch/Client";
import registerPermissions, {registerPermissionInterval} from "./clients/twitch/helper/PermissionHelper";
import WebsocketServer from "./clients/websocket/WebsocketServer";
import {fetchTheme} from "./helper/ThemeHelper";
import WebServer from "./clients/webserver/WebServer";
import {OBSClient} from "./clients/obs/OBSClient";
import initialTimers from "./helper/TimerHelper";
import initialAlerts from "./helper/AlertHelper";
import loadScenes from "./helper/SceneHelper";

let twitchClient: TwitchClient
let websocketServer: WebsocketServer
let webServer: WebServer
let obsClient: OBSClient

void init()

async function init() {
    logSuccess(`Starting ${packageConfig.name} ${packageConfig.version} backend...`)

    logRegular('load config')
    readConfig()

    console.log(JSON.stringify(getConfig(), null, 4))

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

    try {
        logRegular('connect obs')
        obsClient = new OBSClient()
        await obsClient.connect()
        obsClient.registerEvents()
        logSuccess('obs client is ready')
    } catch(error) {
        logWarn('obs connection failed:')
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
    }

    webServer = new WebServer()
    webServer.initial()

    await fetchTheme()

    await obsClient.reloadAllBrowserScenes()

    logRegular('initial schedulers')
    initialTimers()
    initialAlerts()

    logRegular('load scenes')
    loadScenes()

    logRegular('dump obs scenes and items')
    await obsClient.getItems()

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