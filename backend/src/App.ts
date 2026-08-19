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
import loadMacros, {isMacroPresent, triggerMacro} from "./helper/MacroHelper";
import {updateSystemComponents, updateSystemInfo} from "./helper/SystemInfoHelper";
import {updateSourceFilters} from "./helper/SourceHelper";
import {initGpio, killGpio} from "./helper/SystemHelper";
import {downloadVoice, fetchVoices, installPiper} from "./helper/TTShelper";
import {initAutoMacros} from "./helper/AutoMacroHelper";
import * as apiModules from "./api";
import {YoloboxClient} from "./clients/yolobox/YoloboxClient";
import {initAssetWatcher, readAssetFolder} from "./helper/AssetHelper";
import {initNeopixels} from "./helper/NeopixelHelper";
import {loadMusicConfig, startCavaFeed, startMusicPlayer, stopMusicPlayer} from "./helper/MusicHelper";
import {redis} from "./clients/redis/Redis";
import {initVariables} from "./helper/VariableHelper";
import {updateConfiguredEventIndex} from "./helper/EventHelper";
import loadRotateScenes from "./helper/RotateSceneHelper";
import {ensureDefaultOllamaIntegration, loadIntegrationsCache} from "./helper/IntegrationsHelper";
import {initializeUpdateManager, setUpdateManagerNotifier} from "./helper/UpdateHelper";
import {stopOllama, syncOllamaIntegration} from "./helper/OllamaHelper";

let twitchClient: TwitchClient
let websocketServer: WebsocketServer
let webServer: WebServer
let obsClient: OBSClient
let yoloboxClient: YoloboxClient


let ready = false
let stage = 'unknown'
let unreadyMessage = 'backend loading'
let reloadFinished = true

void init()

async function init() {
    unreadyMessage = 'Backend Loading'
    ready = false
    logSuccess(`Starting ${packageConfig.name} ${packageConfig.version} backend...`)

    logRegular('load config')
    readConfig()
    loadIntegrationsCache()
    ensureDefaultOllamaIntegration()

    stage = 'loading_cache'
    await redis.connect()

    stage = 'loading_variables'
    await initVariables()

    stage = 'loading_web_components'
    websocketServer = new WebsocketServer()
    websocketServer.initial()
    websocketServer.registerEvents()

    setUpdateManagerNotifier((method, data) => {
        websocketServer.send(method, data)
    })
    initializeUpdateManager()

    logSuccess('websocket server is ready')

    stage = 'starting_ollama'
    await syncOllamaIntegration()

    webServer = new WebServer()
    await webServer.initial()

    stage = 'loading_system_components'

    await updateSystemComponents()

    stage = 'starting_twitch_bot'

    twitchClient = new TwitchClient()
    await twitchClient.connect()
    await registerPermissions(twitchClient.getBot())
    registerPermissionInterval(twitchClient.getBot())

    try {
        stage = 'connecting_obs'

        logRegular('connecting obs...')
        obsClient = new OBSClient()
        await obsClient.connect()
    } catch(error) {
        logWarn('obs client failed:')
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
    }

    try {
        stage = 'connecting_yolobox'
        logRegular('connect yolobox')
        yoloboxClient = new YoloboxClient()
        await yoloboxClient.connect()
    } catch (error) {
        logWarn('yolobox client failed:')
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
    }

    stage = 'fetching_game_info'

    await fetchGameInfo()

    stage = 'starting_schedulers'
    logRegular('initial schedulers')
    initialTimers()
    initialAlerts()
    initialSchedulers()

    stage = 'initializing_macros'
    loadMacros()

    stage = 'sending_default_wled_colors'
    logRegular('activate configured wled lamps')
    await setLedColor()

    stage = 'starting_audio'
    logRegular('load audio outputs')
    await initAudio()

    stage = 'updating_system_information'
    logRegular("init system info")
    await updateSystemInfo()

    stage = 'reading_assets_folder'
    readAssetFolder()

    stage = 'starting_watchers'
    watchConfig()
    initAssetWatcher()

    stage = 'starting_gpio'
    initGpio()

    stage = 'starting_neopixel'
    await initNeopixels()

    stage = 'starting_tts'
    await installPiper()
    await downloadVoice()
    await fetchVoices()

    stage = 'updating_obs_filters'
    await updateSourceFilters()

    stage = 'starting_auto_macros'
    initAutoMacros()

    stage = 'loading_scene_rotations'
    loadRotateScenes()

    stage = 'starting_music_player'
    loadMusicConfig()
    await startMusicPlayer()

    stage = 'updating_event_index'
    updateConfiguredEventIndex()

    logSuccess('backend is ready')
    ready = true
    stage = 'finished'

    await obsClient?.reloadAllBrowserScenes()

    if(isMacroPresent("event_system_poweron")) {
        await triggerMacro("event_system_poweron")
    }
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
    setReloadUpdate(false)

    try {
        logNotice('init reload')
        readConfig()
        loadIntegrationsCache(true)
        ensureDefaultOllamaIntegration()

        await syncOllamaIntegration()
        await redis.connect()
        await webServer?.precacheConfiguredHtmlTemplates()

        await getTwitchClient().connect()
        await registerPermissions(getTwitchClient()?.getBot())
        loadMacros()
        await fetchGameInfo()

        try {
            await getOBSClient().connect()
        } catch (error) {}

        try {
            await getYoloboxClient().connect()
        } catch (error) {}

        initGpio()

        await initNeopixels()

        await downloadVoice()

        readAssetFolder()

        initAutoMacros()

        loadMusicConfig()
        startCavaFeed()

        logSuccess('reload finished')

        getWebsocketServer().send("notify_config_update", {data: getRawConfig()})

        await obsClient?.reloadAllBrowserScenes()

        if(isMacroPresent("event_system_configreload")) {
            await triggerMacro("event_system_configreload")
        }
    } catch (error) {
        logWarn(`reload failed:`)
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
    } finally {
        setReloadUpdate(true)
    }
}

export function setReloadUpdate(finished: boolean) {
    reloadFinished = finished
    getWebsocketServer()?.send("notify_reload_update", {finished})
}

export function getReloadUpdate() {
    return {
        finished: reloadFinished,
    }
}

export function getYoloboxClient() {
    return yoloboxClient
}

let shutdownStarted = false

async function shutdown() {
    if (shutdownStarted) return
    shutdownStarted = true

    if(isMacroPresent("event_system_poweroff")) {
        await triggerMacro("event_system_poweroff")
    }

    await stopOllama()
    await redis.disconnect()
    await stopMusicPlayer()
    killGpio()
    process.exit()
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())

export function isBackendReady() {
    return ready
}
export function getStartupStage() {
    return stage
}
export function setUnreadyMessage(message: string) {
    unreadyMessage = message
}
export function getUnreadyMessage() {
    return unreadyMessage
}