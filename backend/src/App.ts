import readConfig, {getConfig, watchConfig} from "./helper/ConfigHelper";
import * as packageConfig from '../../package.json'
import {logRegular, logSuccess, logWarn} from "./helper/LogHelper";
import TwitchClient from "./clients/twitch/Client";
import registerPermissions, {registerPermissionInterval} from "./clients/twitch/helper/PermissionHelper";
import WebsocketServer from "./clients/websocket/WebsocketServer";
import {fetchGameInfo} from "./helper/GameHelper";
import WebServer from "./clients/webserver/WebServer";
import {OBSClient} from "./clients/obs/OBSClient";
import initialTimers from "./helper/TimerHelper";
import initialAlerts from "./helper/AlertHelper";
import initialSchedulers from "./helper/SchedulerHelper";
import {setLedColor} from "./helper/WledHelper";
import {initAudio} from "./helper/AudioHelper";
import loadMacros from "./helper/MacroHelper";
import {updateSystemInfo} from "./helper/SystemInfoHelper";
import {updateSourceFilters} from "./helper/SourceHelper";
import TauonmbClient from "./clients/tauonmb/TauonmbClient";
import {initGpio, killGpio} from "./helper/SystemHelper";
import {downloadVoice, fetchVoices, installPiper} from "./helper/TTShelper";

let twitchClient: TwitchClient
let websocketServer: WebsocketServer
let webServer: WebServer
let obsClient: OBSClient
let tauonmbClient: TauonmbClient

void init()

async function init() {
    logSuccess(`Starting ${packageConfig.name} ${packageConfig.version} backend...`)

    logRegular('load config')
    readConfig()

    twitchClient = new TwitchClient()
    await twitchClient.connect()
    await registerPermissions(twitchClient.getBot())
    registerPermissionInterval(twitchClient.getBot())

    websocketServer = new WebsocketServer()
    websocketServer.initial()
    websocketServer.registerEvents()
    logSuccess('websocket server is ready')

    webServer = new WebServer()
    webServer.initial()

    try {
        logRegular('connect obs')
        obsClient = new OBSClient()
        await obsClient.connect()
    } catch(error) {
        logWarn('obs client failed:')
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
    }

    await fetchGameInfo()

    logRegular("connect tauonmb client")
    tauonmbClient = new TauonmbClient()
    await tauonmbClient.init()

    logRegular('initial schedulers')
    initialTimers()
    initialAlerts()
    initialSchedulers()

    loadMacros()

    logRegular('activate configured wled lamps')
    await setLedColor()

    logRegular('load audio outputs')
    await initAudio()

    logRegular("init system info")
    await updateSystemInfo()

    watchConfig()

    initGpio()

    await installPiper()
    await downloadVoice()
    await fetchVoices()

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

export function getTauonmbClient() {
    return tauonmbClient
}

process.on('SIGINT', () => {
    killGpio()
    process.exit()
})