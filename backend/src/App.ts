import readConfig, {getRawConfig, watchConfig} from "./helper/ConfigHelper";
import * as packageConfig from '../../package.json'
import {logNotice, logRegular, logSuccess, logWarn} from "./helper/LogHelper";
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
import {updateSystemComponents, updateSystemInfo} from "./helper/SystemInfoHelper";
import {updateSourceFilters} from "./helper/SourceHelper";
import TauonmbClient from "./clients/tauonmb/TauonmbClient";
import {initGpio, killGpio} from "./helper/SystemHelper";
import {downloadVoice, fetchVoices, installPiper} from "./helper/TTShelper";
import {compressAssets} from "./helper/AssetTuneHelper";
import {initAutoMacros} from "./helper/AutoMacroHelper";
import * as apiModules from "./api";
import {YoloboxClient} from "./clients/yolobox/YoloboxClient";
import {initAssetWatcher, readAssetFolder} from "./helper/AssetHelper";

let twitchClient: TwitchClient
let websocketServer: WebsocketServer
let webServer: WebServer
let obsClient: OBSClient
let tauonmbClient: TauonmbClient
let yoloboxClient: YoloboxClient

let ready = false
let stage = 'Unknown'

void init()

async function init() {
    ready = false
    logSuccess(`Starting ${packageConfig.name} ${packageConfig.version} backend...`)

    logRegular('load config')
    readConfig()

    websocketServer = new WebsocketServer()
    websocketServer.initial()
    websocketServer.registerEvents()
    logSuccess('websocket server is ready')

    webServer = new WebServer()
    webServer.initial()

    await registerApiEndpoints()

    stage = 'loading system components...'

    await updateSystemComponents()

    stage = 'starting twitch bot...'

    twitchClient = new TwitchClient()
    await twitchClient.connect()
    await registerPermissions(twitchClient.getBot())
    registerPermissionInterval(twitchClient.getBot())

    try {
        stage = 'OBS connection'

        logRegular('connecting obs...')
        obsClient = new OBSClient()
        await obsClient.connect()
    } catch(error) {
        logWarn('obs client failed:')
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
    }

    try {
        stage = 'connecting Yolobox...'
        logRegular('connect yolobox')
        yoloboxClient = new YoloboxClient()
        await yoloboxClient.connect()
    } catch (error) {
        logWarn('yolobox client failed:')
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
    }

    stage = 'Fetching Game Info'

    await fetchGameInfo()

    stage = 'connecting tauonmb...'
    logRegular("connect tauonmb client")
    tauonmbClient = new TauonmbClient()
    await tauonmbClient.init()

    stage = 'starting schedulers...'
    logRegular('initial schedulers')
    initialTimers()
    initialAlerts()
    initialSchedulers()

    stage = 'initial macros...'
    loadMacros()

    stage = 'sending default wled colors...'
    logRegular('activate configured wled lamps')
    await setLedColor()

    stage = 'starting audio...'
    logRegular('load audio outputs')
    await initAudio()

    stage = 'update system informations...'
    logRegular("init system info")
    await updateSystemInfo()

    stage = 'reading assets folder...'
    readAssetFolder()

    stage = 'starting watchers...'
    watchConfig()
    initAssetWatcher()

    stage = 'starting gpio...'
    initGpio()

    stage = 'starting tts...'
    await installPiper()
    await downloadVoice()
    await fetchVoices()

    stage = 'compressing assets...'
    await compressAssets()

    stage = 'update obs filters...'
    await updateSourceFilters()

    stage = 'starting auto macros...'
    initAutoMacros()

    logSuccess('backend is ready')
    ready = true
    stage = 'Finished'

    await obsClient?.reloadAllBrowserScenes()
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

export async function registerApiEndpoints() {
    logRegular('register api endpoints')
    websocketServer.clearMessageEvents();

    for(const ApiModule of Object.values(apiModules)) {
        const apiModule = new (ApiModule as any)(websocketServer, webServer)
        apiModule.registerEndpoints()
    }

    logSuccess(`${Object.values(apiModules).length} api endpoints registered`)
}

export async function reload() {
    try {
        logNotice('init reload')
        readConfig()

        await initAudio()

        await getTwitchClient().connect()
        await registerPermissions(getTwitchClient().getBot())
        loadMacros()
        await fetchGameInfo()

        try {
            await getOBSClient().connect()
        } catch (error) {}

        try {
            await getYoloboxClient().connect()
        } catch (error) {}

        initGpio()

        await downloadVoice()

        readAssetFolder()

        await compressAssets()

        initAutoMacros()

        logSuccess('reload finished')

        getWebsocketServer().send("notify_config_update", {data: getRawConfig()})

        await obsClient?.reloadAllBrowserScenes()
    } catch (error) {
        logWarn(`reload failed:`)
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
    }
}

export function getYoloboxClient() {
    return yoloboxClient
}

process.on('SIGINT', () => {
    killGpio()
    process.exit()
})

export function isBackendReady() {
    return ready
}
export function getStartupStage() {
    return stage
}