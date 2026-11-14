import readConfig, {getPrimaryChannel, getRawConfig, watchConfig} from "./helper/ConfigHelper";
import * as packageConfig from '../../package.json'
import {logNotice, logRegular, logSuccess, logWarn} from "./helper/LogHelper";
import TwitchClient from "./clients/twitch/Client";
import registerPermissions, {setModeratorUpdateNotifier} from "./clients/twitch/helper/PermissionHelper";
import WebsocketServer from "./clients/websocket/WebsocketServer";
import {fetchGameInfo} from "./helper/GameHelper";
import WebServer from "./clients/webserver/WebServer";
import {OBSClient} from "./clients/obs/OBSClient";
import initialTimers from "./helper/TimerHelper";
import initialAlerts from "./helper/AlertHelper";
import {initInteractions} from "./helper/InteractionHelper";
import initialSchedulers from "./helper/SchedulerHelper";
import {setLedColor} from "./helper/WledHelper";
import {initAudio} from "./helper/AudioHelper";
import loadMacros, {isMacroPresent, triggerMacro} from "./helper/MacroHelper";
import {updateSystemComponents, updateSystemInfo} from "./helper/SystemInfoHelper";
import {updateSourceFilters} from "./helper/SourceHelper";
import {initGpio, killGpio} from "./helper/SystemHelper";
import {fetchVoices} from "./helper/TTShelper";
import {initAutoMacros} from "./helper/AutoMacroHelper";
import * as apiModules from "./api";
import {YoloboxClient} from "./clients/yolobox/YoloboxClient";
import {initAssetWatcher, readAssetFolder} from "./helper/AssetHelper";
import {initNeopixels} from "./helper/NeopixelHelper";
import {loadMusicConfig, startCavaFeed, startMusicPlayer, stopMusicPlayer} from "./helper/MusicHelper";
import {initMusicEventBridge} from "./helper/MusicEventBridge";
import {redis} from "./clients/redis/Redis";
import {initVariables} from "./helper/VariableHelper";
import {updateConfiguredEventIndex} from "./helper/EventHelper";
import loadRotateScenes from "./helper/RotateSceneHelper";
import {ensureDefaultOllamaIntegration, loadIntegrationsCache} from "./helper/IntegrationsHelper";
import {initializeUpdateManager, setUpdateManagerNotifier} from "./helper/UpdateHelper";
import {shutdownOllama, syncOllamaIntegration} from "./helper/OllamaHelper";
import {setRestoreNotifier} from "./helper/BackupRestoreHelper";
import {initGiveaway} from "./helper/GiveawayHelper";
import {initCategoryLibrary} from "./helper/CategoryLibraryHelper";
import {initVirtualAudioCable} from "./helper/VirtualAudioCableHelper";
import CloudClient from "./clients/cloud/CloudClient";
import {initStreamerClipCache} from "./helper/StreamerClipCacheHelper";
import {refreshTwitchUserList, refreshTwitchUserListRoles} from "./helper/TwitchUserListHelper";
import {initTwitchSubscriptionDurations} from "./helper/TwitchSubscriptionDurationHelper";

let twitchClient: TwitchClient
let websocketServer: WebsocketServer
let webServer: WebServer
let obsClient: OBSClient
let yoloboxClient: YoloboxClient
let cloudClient: CloudClient


let ready = false
let stage = 'unknown'

// Boot stages in order, used to report the progress (step n of total).
const BOOT_STAGES = [
    'loading_web_components',
    'loading_integrations',
    'connecting_cloud',
    'loading_cache',
    'loading_web_content',
    'loading_variables',
    'starting_ollama',
    'loading_system_components',
    'starting_twitch_bot',
    'connecting_obs',
    'connecting_yolobox',
    'fetching_game_info',
    'starting_schedulers',
    'initializing_macros',
    'sending_default_wled_colors',
    'starting_audio',
    'updating_system_information',
    'reading_assets_folder',
    'starting_watchers',
    'starting_gpio',
    'starting_neopixel',
    'loading_tts_voices',
    'updating_obs_filters',
    'starting_auto_macros',
    'loading_scene_rotations',
    'starting_music_player',
    'updating_event_index',
    'finished',
]

/**
 * Sets the current boot stage and publishes it (local panels + cloud) as
 * notify_bootup_stage.
 */
function setStage(next: string) {
    stage = next
    websocketServer?.send('notify_bootup_stage', getBootupState())
}

export function getBootupState() {
    const index = BOOT_STAGES.indexOf(stage)

    return {
        stage,
        ready,
        step: index >= 0 ? index + 1 : 0,
        total: BOOT_STAGES.length,
    }
}
let unreadyMessage = 'backend loading'
let reloadFinished = true

void init()

async function init() {
    unreadyMessage = 'Backend Loading'
    ready = false
    logSuccess(`Starting ${packageConfig.name} ${packageConfig.version} backend...`)

    logRegular('load config')
    readConfig()

    webServer = new WebServer()
    await webServer.initial()

    setStage('loading_web_components')
    websocketServer = new WebsocketServer()
    websocketServer.initial()
    websocketServer.registerEvents()
    setRestoreNotifier((method, data) => websocketServer.send(method, data))

    logSuccess('websocket server is ready')

    await registerApiEndpoints()

    setStage('loading_integrations')
    loadIntegrationsCache()
    ensureDefaultOllamaIntegration()
    cloudClient = new CloudClient()
    websocketServer.setExternalMessageSink((method, data) => cloudClient?.handleLocalUpdate(method, data))
    setModeratorUpdateNotifier(() => {
        cloudClient?.syncModerators()
        refreshTwitchUserListRoles()
    })

    // Connect the cloud as early as possible so the cloud panel can follow
    // (almost) the whole boot. Data that is not loaded yet follows via the
    // normal notifies and a full snapshot once booting has finished.
    try {
        setStage('connecting_cloud')
        await cloudClient.connect()
    } catch (error) {
        logWarn('cloud integration failed:')
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
    }

    setStage('loading_cache')
    await redis.connect()
    await initTwitchSubscriptionDurations()
    await initGiveaway()

    setStage('loading_web_content')
    await webServer.initializeDynamicContent()

    setStage('loading_variables')
    await initVariables()

    setUpdateManagerNotifier((method, data) => {
        websocketServer.send(method, data)
    })
    initializeUpdateManager()

    setStage('starting_ollama')
    await syncOllamaIntegration()

    setStage('loading_system_components')

    await updateSystemComponents()

    setStage('starting_twitch_bot')

    twitchClient = new TwitchClient()
    await twitchClient.connect()
    await initStreamerClipCache(twitchClient.getBot()?.api, getPrimaryChannel())
    await refreshTwitchUserList()
    await initCategoryLibrary(twitchClient.getBot())
    await registerPermissions(twitchClient.getBot())

    try {
        setStage('connecting_obs')

        logRegular('connecting obs...')
        obsClient = new OBSClient()
        await obsClient.connect()
    } catch(error) {
        logWarn('obs client failed:')
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
    }

    try {
        setStage('connecting_yolobox')
        logRegular('connect yolobox')
        yoloboxClient = new YoloboxClient()
        await yoloboxClient.connect()
    } catch (error) {
        logWarn('yolobox client failed:')
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
    }

    setStage('fetching_game_info')

    await fetchGameInfo()

    setStage('starting_schedulers')
    logRegular('initial schedulers')
    initialTimers()
    initInteractions()
    initialAlerts()
    initialSchedulers()

    setStage('initializing_macros')
    loadMacros()

    setStage('sending_default_wled_colors')
    logRegular('activate configured wled lamps')
    await setLedColor()

    setStage('starting_audio')
    logRegular('load audio outputs')
    // Virtual cable sinks must exist before the normal audio routing is restored,
    // because alert/tts/music may be linked to them just like physical outputs.
    await initVirtualAudioCable(websocketServer)
    await initAudio()

    setStage('updating_system_information')
    logRegular("init system info")
    await updateSystemInfo()

    setStage('reading_assets_folder')
    readAssetFolder()

    setStage('starting_watchers')
    watchConfig()
    initAssetWatcher()

    setStage('starting_gpio')
    initGpio()

    setStage('starting_neopixel')
    await initNeopixels()

    setStage('loading_tts_voices')
    await fetchVoices()

    setStage('updating_obs_filters')
    await updateSourceFilters()

    setStage('starting_auto_macros')
    initAutoMacros()

    setStage('loading_scene_rotations')
    loadRotateScenes()

    setStage('starting_music_player')
    initMusicEventBridge()
    loadMusicConfig()
    await startMusicPlayer()

    setStage('updating_event_index')
    updateConfiguredEventIndex()

    logSuccess('backend is ready')
    ready = true
    setStage('finished')

    // The cloud connected early during boot; send the now complete state.
    cloudClient?.syncModerators()
    cloudClient?.sendSnapshot()

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

export function getCloudClient() {
    return cloudClient
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

        if (!cloudClient) cloudClient = new CloudClient()
        websocketServer?.setExternalMessageSink((method, data) => cloudClient?.handleLocalUpdate(method, data))
        setModeratorUpdateNotifier(() => {
        cloudClient?.syncModerators()
        refreshTwitchUserListRoles()
    })

        await syncOllamaIntegration()
        await redis.connect()
        await initGiveaway()
        await webServer?.precacheConfiguredHtmlTemplates()

        await getTwitchClient().connect()
        await initStreamerClipCache(getTwitchClient().getBot()?.api, getPrimaryChannel())
        await refreshTwitchUserList()
        await registerPermissions(getTwitchClient()?.getBot())
        try {
            await cloudClient.connect()
        } catch (error) {
            logWarn('cloud integration reload failed:')
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
        }
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

    await shutdownOllama()
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