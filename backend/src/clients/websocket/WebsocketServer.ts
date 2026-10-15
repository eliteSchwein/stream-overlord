import WebSocket, {WebSocketServer} from "ws";
import {getConfig, getRawConfig, getSettings} from "../../helper/ConfigHelper";
import {logError, logRegular, logWarn} from "../../helper/LogHelper";
import ConnectEvent from "./events/ConnectEvent";
import {getRandomInt} from "../../../../helper/GeneralHelper";
import isShieldActive from "../../helper/ShieldHelper";
import {getChannelPointUpdatePayload} from "../../helper/ChannelPointHelper";
import {getAudioData, getAudioOutputs, getAudioPresets} from "../../helper/AudioHelper";
import {getSystemInfo} from "../../helper/SystemInfoHelper";
import {getSourceFilters} from "../../helper/SourceHelper";
import {getOBSClient, getReloadUpdate, getYoloboxClient} from "../../App";
import getGameInfo from "../../helper/GameHelper";
import {getAllVisibleElements, isTestModeActive, toggleElementVisiblity} from "../../helper/VisibleHelper";
import {getVoices} from "../../helper/TTShelper";
import {getMacros} from "../../helper/MacroHelper";
import {getConfiguredCommands} from "../../clients/twitch/TwitchCommands";
import {getAutoMacros} from "../../helper/AutoMacroHelper";
import {getRotateScenes} from "../../helper/RotateSceneHelper";
import {getGiveaway} from "../../helper/GiveawayHelper";
import BaseApi from "../../abstracts/BaseApi";
import {getParsedAssetFiles} from "../../helper/AssetHelper";
import {getPlaylistUpdatePayload, getStatus} from "../../helper/MusicHelper";
import {getManagedConnections, setConnectionUpdateNotifier} from "../../helper/ConnectionHelper";
import {getSystemStorageInfo} from "../../helper/SystemStorageHelper";
import {emitVariablesUpdate} from "../../helper/VariableHelper";
import {getIntegrationsSafe} from "../../helper/IntegrationsHelper";
import {getUpdateManagerStatus} from "../../helper/UpdateHelper";
import {getOllamaUpdate} from "../../helper/OllamaHelper";
import {getConfiguredEventIndex} from "../../helper/EventHelper";
import {getDynamicData} from "../../helper/DynamicDataHelper";
import {getSpeedtestState} from "../../helper/SpeedtestHelper";
import {getInteractionQueue} from "../../helper/InteractionHelper";
import {getActiveCategoryMediaReplayNotifications, getActiveCategoryPayload, getActiveCategoryStylePayload, getCategoryLibrary} from "../../helper/CategoryLibraryHelper";
import {getVirtualAudioCables} from "../../helper/VirtualAudioCableHelper";
import {getTwitchDataPayload, setTwitchDataNotifier} from "../../helper/TwitchDataHelper";


export default class WebsocketServer {
    private externalMessageSink?: (method: string, data: any) => void;
    private cavaConnections = new Map<string, Set<any>>();
    private cavaLastFrames = new Map<string, string>();
    private sentStateByConnection = new WeakMap<any, Map<string, any>>();
    private pendingStateByConnection = new WeakMap<any, Map<string, {data: any}>>();
    private pendingFlushTimers = new WeakMap<any, NodeJS.Timeout>();
    private readonly localBufferedAmountLimit = 4 * 1024 * 1024;
    private readonly cavaBufferedAmountLimit = 256 * 1024;
    private heartbeatTimer?: NodeJS.Timeout;
    private readonly statefulEndpoints = new Set<string>([
        'notify_interaction_queue',
        'notify_assets_update',
        'notify_ads',
        'notify_toggle_element',
        'notify_source_update',
        'notify_system_info',
        'notify_audio_update',
        'notify_virtual_audio_cables',
        'notify_channel_point_update',
        'notify_shield_mode',
        'notify_game_update',
        'notify_timer',
        'notify_visible_element',
        'notify_connection',
        'notify_connection_update',
        'notify_config_update',
        'notify_obs_scene_update',
        'notify_obs_scene_update_named',
        'notify_obs_audio_update',
        'notify_obs_audio_update_named',
        'notify_test_mode',
        'notify_voice_list_update',
        'notify_macro_update',
        'notify_commands_update',
        'notify_auto_macros_update',
        'notify_rotating_scene_update',
        'notify_rotating_scene_runtime_update',
        'notify_variables_update',
        'notify_giveaway_update',
        'notify_yolobox_update',
        'notify_music_show',
        'notify_music_update',
        'notify_audio_outputs_update',
        'notify_audio_presets_update',
        'notify_storage_update',
        'notify_integrations_update',
        'notify_settings_update',
        'notify_playlist_update',
        'notify_reload_update',
        'notify_update_manager',
        'notify_ollama_update',
        'notify_events_update',
        'notify_dynamic_data_update',
        'notify_speedtest_update',
        'notify_category_library_update',
        'notify_category_active',
        'notify_category_style_update',
        'notify_twitch_data',
    ]);
    websocket: WebSocketServer
    validEndpoints: string[] = [
        'notify_alert',
        'notify_alert_query',
        'notify_interaction',
        'notify_interaction_queue',
        'notify_assets_update',
        'notify_ads',
        'notify_effect',
        'notify_toggle_element',
        'notify_random_clips',
        'notify_source_update',
        'notify_system_info',
        'notify_audio_update',
        'notify_virtual_audio_cables',
        'notify_channel_point_update',
        'notify_shield_mode',
        'notify_game_update',
        'notify_throttle',
        'notify_timer',
        'trigger_keyboard',
        'notify_visible_element',
        'notify_connection',
        'notify_connection_update',
        'notify_config_update',
        'notify_obs_scene_update',
        'notify_obs_scene_update_named',
        'notify_obs_audio_update',
        'notify_obs_audio_update_named',
        'notify_test_mode',
        'notify_power_button',
        'notify_voice_list_update',
        'notify_macro_update',
        'notify_commands_update',
        'notify_auto_macros_update',
        'notify_rotating_scene_update',
        'notify_rotating_scene_runtime_update',
        'notify_variables_update',
        'notify_giveaway_update',
        'notify_yolobox_update',
        'notify_music_show',
        'notify_music_update',
        'notify_animation_update',
        'notify_audio_outputs_update',
        'notify_audio_presets_update',
        'notify_media_update',
        'notify_storage_update',
        'notify_variables_update',
        'notify_integrations_update',
        'notify_settings_update',
        'notify_playlist_update',
        'notify_reload_update',
        'notify_service_reload',
        'notify_update_manager',
        'notify_ollama_update',
        'notify_events_update',
        'notify_dynamic_data_update',
        'notify_speedtest_update',
        'notify_restore_ready',
        'notify_restore_complete',
        'notify_restore_cancelled',
        'notify_category_library_update',
        'notify_category_active',
        'notify_category_style_update',
        'notify_twitch_data',
    ]
    connectionEndpoints = {}
    messageEvents: BaseApi[] = []

    public initial() {
        const config = getConfig(/websocket/g)[0]

        logRegular(`initial websocket server`)

        setTwitchDataNotifier((payload) => this.send("notify_twitch_data", payload))

        this.websocket = new WebSocketServer({port: config?.port ?? 8100, host: '0.0.0.0', maxPayload: 512 * 1024 * 1024})
        this.startHeartbeat()

        // Dedicated high-frequency CAVA sockets share the same listener/port but
        // use their own WebSocket connection per feed: /cava/<target>.
        // They intentionally bypass the regular endpoint registration/state sync.
        this.websocket.on('connection', (socket: any, request: any) => {
            socket.__streambotAlive = true
            socket.on('pong', () => { socket.__streambotAlive = true })

            const target = this.getCavaTargetFromUrl(request?.url)
            if (!target) return

            socket.__streambotCavaTarget = target
            this.addCavaConnection(target, socket)
        })

        setConnectionUpdateNotifier((connections) => {
            this.send("notify_connection_update", connections)
        })
    }

    private startHeartbeat() {
        if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
        this.heartbeatTimer = setInterval(() => {
            for (const socket of this.websocket.clients as Set<any>) {
                if (socket.__streambotAlive === false) {
                    try { socket.terminate() } catch {}
                    continue
                }

                socket.__streambotAlive = false
                try { socket.ping() } catch {
                    try { socket.terminate() } catch {}
                }
            }
        }, 30_000)
        this.heartbeatTimer.unref?.()
    }

    public registerEvents() {
        void new ConnectEvent(this.websocket, this).register()
    }

    private getCavaTargetFromUrl(rawUrl: unknown): string | null {
        const pathname = String(rawUrl ?? '').split('?', 1)[0]
        const match = pathname.match(/^\/cava\/([^/]+)\/?$/)
        if (!match) return null

        try {
            return decodeURIComponent(match[1]).trim() || null
        } catch {
            return null
        }
    }

    private addCavaConnection(target: string, connection: any) {
        if (!this.cavaConnections.has(target)) {
            this.cavaConnections.set(target, new Set())
        }

        this.cavaConnections.get(target)!.add(connection)
        logRegular(`cava websocket connected: ${target}`)

        const initialFrame = this.cavaLastFrames.get(target)
        if (initialFrame !== undefined && connection.readyState === WebSocket.OPEN) {
            try {
                connection.send(JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'notify_music_cava',
                    params: {target, raw: initialFrame},
                    id: getRandomInt(10_000),
                }))
            } catch {}
        }

        connection.on('close', () => {
            const connections = this.cavaConnections.get(target)
            connections?.delete(connection)
            if (connections?.size === 0) this.cavaConnections.delete(target)
        })
    }

    public isCavaConnection(connection: any): boolean {
        return typeof connection?.__streambotCavaTarget === 'string'
    }

    public sendCava(target: string, raw: string): number {
        if (this.cavaLastFrames.get(target) === raw) return 0
        this.cavaLastFrames.set(target, raw)

        const connections = this.cavaConnections.get(target)
        if (!connections?.size) return 0

        const payload = JSON.stringify({
            jsonrpc: '2.0',
            method: 'notify_music_cava',
            params: {target, raw},
            id: getRandomInt(10_000),
        })

        let delivered = 0
        for (const connection of Array.from(connections)) {
            try {
                if (connection.readyState !== WebSocket.OPEN) {
                    connections.delete(connection)
                    continue
                }

                // CAVA is real-time visualization data. Never let stale frames build
                // an unbounded ws send queue when a client is slow.
                if (connection.bufferedAmount > this.cavaBufferedAmountLimit) {
                    continue
                }

                connection.send(payload)
                delivered++
            } catch (error) {
                connections.delete(connection)
                logError(`cava websocket send failed: ${target}`)
                logError(JSON.stringify(error, Object.getOwnPropertyNames(error)))
            }
        }

        if (connections.size === 0) this.cavaConnections.delete(target)
        return delivered
    }

    public getCavaConnections() {
        return Object.fromEntries(
            Array.from(this.cavaConnections.entries()).map(([target, connections]) => [target, connections.size])
        )
    }

    public setExternalMessageSink(callback?: (method: string, data: any) => void) {
        this.externalMessageSink = callback;
    }

    public getWebsocket() {
        return this.websocket
    }

    private isStateRecord(value: any): value is Record<string, any> {
        return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    }

    private cloneStateValue(value: any): any {
        if (Array.isArray(value)) return value.map((entry) => this.cloneStateValue(entry))
        if (!this.isStateRecord(value)) return value

        const result: Record<string, any> = {}
        for (const [key, entry] of Object.entries(value)) {
            result[key] = this.cloneStateValue(entry)
        }
        return result
    }

    /**
     * Build a JSON merge-style delta for local websocket state. Objects are
     * diffed recursively, arrays are atomic, and removed keys are represented
     * as null. Returning undefined means there is no change to send.
     */
    private createStateDelta(previous: any, next: any): any | undefined {
        if (Object.is(previous, next)) return undefined

        if (Array.isArray(previous) || Array.isArray(next)) {
            try {
                if (JSON.stringify(previous) === JSON.stringify(next)) return undefined
            } catch {}
            return this.cloneStateValue(next)
        }

        if (this.isStateRecord(previous) && this.isStateRecord(next)) {
            const delta: Record<string, any> = {}
            let changed = false

            for (const key of Object.keys(next)) {
                const childDelta = this.createStateDelta(previous[key], next[key])
                if (childDelta === undefined) continue
                delta[key] = childDelta
                changed = true
            }

            for (const key of Object.keys(previous)) {
                if (Object.prototype.hasOwnProperty.call(next, key)) continue
                delta[key] = null
                changed = true
            }

            return changed ? delta : undefined
        }

        return this.cloneStateValue(next)
    }

    /**
     * Most notify methods have exactly one state object per method. Named OBS
     * notifications carry multiple independent states under the same method,
     * so include the OBS connection name in the cache key.
     */
    private getStateCacheKey(method: string, data: any): string {
        if (method === 'notify_obs_scene_update_named' || method === 'notify_obs_audio_update_named') {
            return `${method}:${String(data?.connection ?? 'default')}`
        }
        return method
    }

    public send(method: string, data: any = {}, connection?: WebSocket) {
        if(method === 'notify_visible_element') {
            toggleElementVisiblity(data.target, data.state)
        }

        if (!connection && this.externalMessageSink) {
            try {
                // External sinks (cloud) receive the authoritative full local state
                // and maintain their own independent delta baseline.
                this.externalMessageSink(method, data);
            } catch (error) {
                logError("external websocket message sink failed")
                logError(JSON.stringify(error, Object.getOwnPropertyNames(error)))
            }
        }

        const targets: any[] = connection ? [connection] : [...this.websocket.clients]
        const stateful = this.statefulEndpoints.has(method)
        let delivered = 0

        for (const client of targets) {
            try {
                if (this.isCavaConnection(client)) continue
                if (client.readyState !== WebSocket.OPEN) continue

                const clientKey = `${client._socket?.remoteAddress}:${client._socket?.remotePort}`
                const allowed = this.connectionEndpoints[clientKey]
                if (!allowed || !allowed.includes(method)) continue

                let payloadData = data
                let partial = false
                let stateKey: string | undefined
                let sentState: Map<string, any> | undefined

                if (stateful) {
                    stateKey = this.getStateCacheKey(method, data)
                    sentState = this.sentStateByConnection.get(client)
                    if (!sentState) {
                        sentState = new Map<string, any>()
                        this.sentStateByConnection.set(client, sentState)
                    }

                    if (sentState.has(stateKey)) {
                        const delta = this.createStateDelta(sentState.get(stateKey), data)
                        if (delta === undefined) continue
                        payloadData = delta
                        partial = true
                    }
                }

                // Do not allow one stalled browser/overlay to turn the ws library into
                // an unbounded in-memory message queue. Stateful notifications are
                // coalesced to the newest full state and diffed against the last state
                // actually delivered when the client catches up.
                if (client.bufferedAmount > this.localBufferedAmountLimit) {
                    if (stateful) this.queuePendingState(client, method, data)
                    continue
                }

                client.send(JSON.stringify({
                    jsonrpc: "2.0",
                    method,
                    params: payloadData,
                    ...(partial ? {partial: true} : {}),
                    id: getRandomInt(10_000)
                }))

                if (stateful && stateKey && sentState) {
                    sentState.set(stateKey, this.cloneStateValue(data))
                    this.pendingStateByConnection.get(client)?.delete(stateKey)
                }
                delivered++
            } catch (error) {
                logError("request to a websocket client failed!")
                logError(JSON.stringify(error, Object.getOwnPropertyNames(error)))
            }
        }

        return delivered
    }

    private queuePendingState(client: any, method: string, data: any) {
        let pending = this.pendingStateByConnection.get(client)
        if (!pending) {
            pending = new Map()
            this.pendingStateByConnection.set(client, pending)
        }

        const stateKey = this.getStateCacheKey(method, data)
        pending.set(stateKey, {data: this.cloneStateValue(data)})

        if (this.pendingFlushTimers.has(client)) return
        const timer = setTimeout(() => {
            this.pendingFlushTimers.delete(client)
            this.flushPendingState(client)
        }, 100)
        timer.unref?.()
        this.pendingFlushTimers.set(client, timer)
    }

    private flushPendingState(client: any) {
        const pending = this.pendingStateByConnection.get(client)
        if (!pending?.size) return
        if (client.readyState !== WebSocket.OPEN) {
            pending.clear()
            return
        }

        if (client.bufferedAmount > this.localBufferedAmountLimit) {
            const timer = setTimeout(() => {
                this.pendingFlushTimers.delete(client)
                this.flushPendingState(client)
            }, 100)
            timer.unref?.()
            this.pendingFlushTimers.set(client, timer)
            return
        }

        for (const [stateKey, entry] of Array.from(pending.entries())) {
            if (client.bufferedAmount > this.localBufferedAmountLimit) {
                const timer = setTimeout(() => {
                    this.pendingFlushTimers.delete(client)
                    this.flushPendingState(client)
                }, 100)
                timer.unref?.()
                this.pendingFlushTimers.set(client, timer)
                return
            }

            // The pending entry stores the authoritative newest full state. send()
            // calculates the cumulative delta from the last state actually delivered.
            const method = stateKey.split(':', 1)[0]
            this.send(method, entry.data, client)
            pending.delete(stateKey)
        }
    }

    public addConnection(connection: WebSocket, endpoints: string[]): string[] {
        // @ts-ignore
        const client = `${connection._socket.remoteAddress}:${connection._socket.remotePort}`

        // expand "all" shortcut
        if (endpoints[0] === "all") {
            endpoints = this.validEndpoints
        }

        const invalidEndpoints = endpoints.filter(
            (ep) => !this.validEndpoints.includes(ep)
        )

        const validNewEndpoints = endpoints.filter(
            (ep) => this.validEndpoints.includes(ep)
        )

        if (!this.connectionEndpoints[client]) {
            this.connectionEndpoints[client] = []
        }

        // add only the new ones that aren't already present
        const newlyAddedEndpoints: string[] = []
        for (const ep of validNewEndpoints) {
            if (!this.connectionEndpoints[client].includes(ep)) {
                this.connectionEndpoints[client].push(ep)
                newlyAddedEndpoints.push(ep)
            }
        }

        if (newlyAddedEndpoints.length > 0) {
            // Existing subscriptions retain their sent-state cache, so an incremental
            // registration only produces the initial values for newly registered data.
            const sentState = this.sentStateByConnection.get(connection as any)
            if (sentState) {
                for (const endpoint of newlyAddedEndpoints) {
                    for (const key of Array.from(sentState.keys())) {
                        if (key === endpoint || key.startsWith(`${endpoint}:`)) sentState.delete(key)
                    }
                }
            }
            this.sendUpdate(connection, newlyAddedEndpoints)
        }

        this.send("notify_connection", this.getConnections())

        return invalidEndpoints
    }

    public disconnectConnection(client: string) {
        for(const socket of this.websocket.clients) {
            const socketId = `${socket._socket.remoteAddress}:${socket._socket.remotePort}`

            if(socketId !== client) continue

            logWarn(`client disconnected: ${client} reason: disconnect message!`)
            socket.send(JSON.stringify({jsonrpc: "2.0", method: 'notify_disconnect', params: {reason: 'disconnect message!'}, id: getRandomInt(10_000)}))
            socket.close()

            this.removeConnection(client)
        }
    }

    public removeConnection(client: string) {
        delete this.connectionEndpoints[client];

        this.send("notify_connection", this.getConnections())
    }

    public getEndpointSubscriberCount(endpoint: string): number {
        return Object.values(this.connectionEndpoints).filter((endpoints: any) =>
            Array.isArray(endpoints) && endpoints.includes(endpoint)
        ).length
    }

    public isConnectionRegistered(client: string): boolean {
        return Object.keys(this.connectionEndpoints).includes(client)
    }

    public sendUpdate(connection?: WebSocket, onlyEndpoints?: string[]) {
        // @ts-ignore
        const targets = connection ? [connection] : [...this.websocket.clients]
        const endpointFilter = onlyEndpoints ? new Set(onlyEndpoints) : null

        targets.forEach((client) => {
            try {
                const initialSend = (method: string, data: any) => {
                    if (endpointFilter && !endpointFilter.has(method)) return 0
                    return this.send(method, data, client)
                }

                initialSend("notify_shield_mode", {
                    action: isShieldActive() ? "enable" : "disable"
                })

                initialSend("notify_game_update", getGameInfo())
                initialSend("notify_channel_point_update", getChannelPointUpdatePayload())
                initialSend("notify_twitch_data", getTwitchDataPayload())
                initialSend("notify_audio_update", getAudioData())
                initialSend("notify_system_info", getSystemInfo())
                initialSend("notify_source_update", getSourceFilters())
                initialSend("notify_music_update", getStatus())
                initialSend("notify_playlist_update", getPlaylistUpdatePayload())
                initialSend("notify_connection", this.getConnections())
                initialSend("notify_connection_update", getManagedConnections())
                const obsClient = getOBSClient()

                initialSend("notify_obs_scene_update", obsClient?.getSceneData())
                initialSend("notify_obs_audio_update", obsClient?.getAudioData())

                for(const connectionName of obsClient?.getConnectionNames?.() ?? []) {
                    initialSend("notify_obs_scene_update_named", {
                        connection: connectionName,
                        scenes: obsClient?.getSceneData(connectionName) ?? [],
                    })
                    initialSend("notify_obs_audio_update_named", {
                        connection: connectionName,
                        audio: obsClient?.getAudioData(connectionName) ?? {},
                    })
                }
                initialSend("notify_config_update", {data: getRawConfig()})
                initialSend("notify_test_mode", {active: isTestModeActive()})
                initialSend("notify_voice_list_update", {voices: getVoices()})
                initialSend("notify_macro_update", {macros: getMacros()})
                initialSend("notify_commands_update", {commands: getConfiguredCommands()})
                initialSend("notify_auto_macros_update", getAutoMacros())
                initialSend("notify_rotating_scene_update", {rotatingScenes: getRotateScenes()})
                initialSend("notify_events_update", {events: getConfiguredEventIndex()})
                initialSend("notify_interaction_queue", getInteractionQueue())
                initialSend("notify_dynamic_data_update", {dynamic_data: getDynamicData()})
                initialSend("notify_speedtest_update", getSpeedtestState())
                // initialSend("notify_variables_update", getTemplateVariables())
                initialSend("notify_giveaway_update", getGiveaway())
                initialSend("notify_yolobox_update", getYoloboxClient()?.getData())
                initialSend("notify_assets_update", getParsedAssetFiles())
                initialSend("notify_audio_outputs_update", getAudioOutputs())
                initialSend("notify_audio_presets_update", {presets: getAudioPresets()})
                initialSend("notify_storage_update", getSystemStorageInfo())
                initialSend("notify_integrations_update", getIntegrationsSafe())
                initialSend("notify_settings_update", getSettings())
                initialSend("notify_reload_update", getReloadUpdate())
                initialSend("notify_service_reload", {})
                initialSend("notify_update_manager", getUpdateManagerStatus())
                initialSend("notify_ollama_update", getOllamaUpdate())
                initialSend("notify_category_library_update", getCategoryLibrary())
                initialSend("notify_category_active", getActiveCategoryPayload())
                initialSend("notify_category_style_update", getActiveCategoryStylePayload())
                // Virtual audio media is transported via MediaMTX/WebRTC.
                // WebSocket carries signaling/state only.
                initialSend("notify_virtual_audio_cables", {cables: getVirtualAudioCables()})
                // Fresh overlays receive an authoritative category-media snapshot:
                // clear all category-owned targets first, then replay the active/fallback media.
                if (!endpointFilter || endpointFilter.has('notify_media_update')) {
                    for (const media of getActiveCategoryMediaReplayNotifications()) {
                        initialSend("notify_media_update", media)
                    }
                }

                if (!endpointFilter || endpointFilter.has('notify_variables_update')) {
                    void emitVariablesUpdate(client)
                }

                if (!endpointFilter || endpointFilter.has('notify_visible_element')) {
                    for(const id in getAllVisibleElements()) {
                        const state = getAllVisibleElements()[id]
                        initialSend("notify_visible_element", {target: id, state: state})
                    }
                }
            } catch (error) {
                logError("failed to send update to client")
                logError(JSON.stringify(error, Object.getOwnPropertyNames(error)))
            }
        })
    }

    public getConnections() {
        return this.connectionEndpoints
    }

    public addMessageEvent(event: BaseApi) {
        this.messageEvents.push(event)
    }

    public getMessageEvents(): BaseApi[] {
        return this.messageEvents
    }

    /**
     * Execute one of the already-registered websocket API methods internally.
     * This deliberately calls BaseApi.handle(params) directly so non-websocket
     * transports (for example the optional cloud integration) reuse the exact
     * same backend implementation as Commander without creating a fake socket.
     */
    public async dispatchApiMethod(method: string, params: any = {}) {
        const normalizedMethod = String(method ?? '').trim()
        if (!normalizedMethod) throw new Error('websocket API method is required')

        const endpoint = this.messageEvents.find(
            event => event.getWebsocketMethod() === normalizedMethod
        )

        if (!endpoint) {
            throw new Error(`unknown websocket API method: ${normalizedMethod}`)
        }

        const result = await endpoint.handle(params ?? {})

        if (result?.error) {
            throw new Error(String(result.error))
        }

        return result ?? {status: 'okay'}
    }

    public clearMessageEvents() {
        this.messageEvents = []
    }
}