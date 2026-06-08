import {getConfig} from "../../helper/ConfigHelper";
import OBSWebSocket, {EventSubscription, OBSWebSocketError} from "obs-websocket-js";
import {getLogConfig, logCustom, logDebug, logNotice, logRegular, logSuccess, logWarn} from "../../helper/LogHelper";
import {updateSourceFilters} from "../../helper/SourceHelper";
import getWebsocketServer from "../../App";
import RotatingSceneEvent from "./events/RotatingSceneEvent";
import InputUpdateEvent from "./events/InputUpdateEvent";
import _ = require("lodash");

type OBSConfig = {
    ip: string
    port: number
    password?: string
}

type OBSConnection = {
    name: string
    config: OBSConfig
    obsWebsocket?: OBSWebSocket
    mixerObsWebsocket?: OBSWebSocket
    connected: boolean
    sceneData: any[]
    eventFetching: boolean
    audioData: Record<string, any>
}

export class OBSClient {
    obsWebsocket: OBSWebSocket
    mixerObsWebsocket: OBSWebSocket
    connected = false
    sceneData: []
    eventFetching = false
    audioData: {}

    private connections: Record<string, OBSConnection> = {}
    private reconnectTimers: Record<string, NodeJS.Timeout> = {}

    public async connect() {
        const configs = this.getObsConfigs()

        this.connected = false
        this.sceneData = []
        this.connections = {}

        if(Object.keys(configs).length === 0) {
            logDebug("OBS Config not found, disable OBS Client")
            return
        }

        await this.disconnect()

        for (const [name, config] of Object.entries(configs)) {
            await this.connectSingle(name, config)
        }

        await updateSourceFilters()
    }

    private getObsConfigs(): Record<string, OBSConfig> {
        const configs: Record<string, OBSConfig> = {}

        const namedConfigs = getConfig(/^obs/g, true)

        if(namedConfigs && !Array.isArray(namedConfigs) && typeof namedConfigs === 'object') {
            for(const rawName in namedConfigs) {
                const config = namedConfigs[rawName]

                if(!config?.ip) continue

                const name = this.normalizeConnectionName(rawName)

                configs[name] = config
            }
        }

        if(Object.keys(configs).length > 0) {
            return configs
        }

        const fallbackConfigs = getConfig(/^obs/g)

        fallbackConfigs.forEach((config: OBSConfig, index: number) => {
            if(!config?.ip) return

            const name = index === 0 ? 'default' : `obs_${index + 1}`

            configs[name] = config
        })

        return configs
    }

    private normalizeConnectionName(rawName: string) {
        const name = String(rawName)
            .replace(/^obs\s*/i, '')
            .trim()

        return name || 'default'
    }

    private async connectSingle(name: string, config: OBSConfig) {
        const connection: OBSConnection = {
            name,
            config,
            connected: false,
            sceneData: [],
            eventFetching: false,
            audioData: {},
        }

        this.connections[name] = connection

        try {
            connection.obsWebsocket = new OBSWebSocket()
            await connection.obsWebsocket.connect(`ws://${config.ip}:${config.port}`, config.password ?? '', {
                eventSubscriptions: EventSubscription.All
            })
        } catch (error) {
            logDebug(`obs connection failed (${name}):`)
            logDebug(JSON.stringify(error, Object.getOwnPropertyNames(error)))
            this.reconnectSingle(name)
            return
        }

        try {
            connection.mixerObsWebsocket = new OBSWebSocket()
            await connection.mixerObsWebsocket.connect(`ws://${config.ip}:${config.port}`, config.password ?? '', {
                eventSubscriptions: EventSubscription.InputVolumeMeters
            })
        } catch (error) {
            logDebug(`obs mixer connection failed (${name}):`)
            logDebug(JSON.stringify(error, Object.getOwnPropertyNames(error)))

            await connection.obsWebsocket?.disconnect()
            this.reconnectSingle(name)
            return
        }

        this.registerEvents(connection)

        connection.connected = true

        this.syncDefaultConnection()

        await this.reloadAllBrowserScenes(name)

        await this.fetchItems(name)

        logSuccess(`obs client is ready: ${name}`)
    }

    private reconnectSingle(name: string) {
        if(this.reconnectTimers[name]) return

        logDebug(`reconnect obs ${name} in 5 seconds...`)

        this.reconnectTimers[name] = setTimeout(async () => {
            delete this.reconnectTimers[name]

            const config = this.connections[name]?.config ?? this.getObsConfigs()[name]

            if(!config) return

            await this.connectSingle(name, config)
        }, 5_000)
    }

    public async disconnect() {
        for(const timer of Object.values(this.reconnectTimers)) {
            clearTimeout(timer)
        }

        this.reconnectTimers = {}

        for(const connection of Object.values(this.connections)) {
            await connection.obsWebsocket?.disconnect()
            await connection.mixerObsWebsocket?.disconnect()
        }
    }

    public registerEvents(connection: OBSConnection = this.getDefaultConnection()) {
        if(!connection?.obsWebsocket) return

        connection.obsWebsocket.on('ConnectionClosed', async (error: OBSWebSocketError) => {
            await this.handleOBSError(connection.name, error)
        })
        connection.obsWebsocket.on('ConnectionError', async (error: OBSWebSocketError) => {
            await this.handleOBSError(connection.name, error)
        })

        const events = [
            "CurrentProfileChanged",
            "CurrentSceneCollectionChanged",
            "SceneCollectionListChanged",
            "ProfileListChanged",
            "SceneCreated",
            "SceneRemoved",
            "SceneNameChanged",
            "SceneListChanged",
            "SceneItemCreated",
            "SceneItemRemoved",
            "SceneItemListReindexed",
            "InputNameChanged",
        ]

        events.forEach(event =>
            // @ts-ignore
            connection.obsWebsocket.on(event, async () => {
                if(connection.eventFetching) return
                connection.eventFetching = true
                await this.fetchItems(connection.name)
                connection.eventFetching = false
            })
        )

        if(connection.name === 'default') {
            new RotatingSceneEvent(this).register()
            new InputUpdateEvent(this).register()
        }
    }

    private async handleOBSError(name: string, error: OBSWebSocketError) {
        const connection = this.connections[name]

        logWarn(`obs disconnect (${name}): ${error.code} ${error.message}`)

        if(!connection?.connected) return

        connection.connected = false

        this.syncDefaultConnection()

        await updateSourceFilters()

        logWarn(`reconnect obs ${name} now...`)

        this.reconnectSingle(name)
    }

    private getDefaultConnection() {
        return this.connections.default ?? Object.values(this.connections)[0]
    }

    private getConnection(name = 'default') {
        const connection = this.connections[name]

        if(connection) return connection

        logWarn(`obs connection not found: ${name}`)

        return undefined
    }

    private syncDefaultConnection() {
        const connection = this.getDefaultConnection()

        // Keep old public fields working for existing code.
        // @ts-ignore
        this.obsWebsocket = connection?.obsWebsocket
        // @ts-ignore
        this.mixerObsWebsocket = connection?.mixerObsWebsocket
        this.connected = connection?.connected ?? false
        // @ts-ignore
        this.sceneData = connection?.sceneData ?? []
        this.eventFetching = connection?.eventFetching ?? false
        this.audioData = connection?.audioData ?? {}
    }

    public getConnectionNames() {
        return Object.keys(this.connections)
    }

    public getSceneData(connectionName = 'default') {
        return this.getConnection(connectionName)?.sceneData ?? []
    }

    public getOBSWebSocket(connectionName = 'default') {
        return this.getConnection(connectionName)?.obsWebsocket
    }

    public getMixerObsWebSocket(connectionName = 'default') {
        return this.getConnection(connectionName)?.mixerObsWebsocket
    }

    public getAudioData(connectionName = 'default') {
        return this.getConnection(connectionName)?.audioData ?? {}
    }

    public getSceneItemByUuid(uuid: string, connectionName = 'default') {
        const sceneData = this.getSceneData(connectionName)

        for (const scene of sceneData) {
            for (const sceneItem of scene.items) {
                if(sceneItem.uuid !== uuid) continue

                const clonedSceneItem = Object.assign({}, sceneItem)
                clonedSceneItem.scene = scene

                return clonedSceneItem
            }
        }

        return undefined
    }

    public async send(method: string, data: any, connectionName = 'default') {
        const connection = this.getConnection(connectionName)

        if(!connection?.connected || !connection.obsWebsocket) {
            logWarn(`obs ${connectionName} is currently not connected`)
            return
        }

        await connection.obsWebsocket.call(method, data)
    }

    public async fetchItems(connectionName = 'default') {
        const connection = this.getConnection(connectionName)

        if(!connection?.connected || !connection.obsWebsocket) return

        const fullObsLog = getLogConfig().full_obs_log

        if(fullObsLog) {
            logNotice(`dump all obs scenes and items (${connectionName}):`)
        } else {
            logNotice(`dump all obs scenes and items (${connectionName})`)
        }

        const {scenes} = await connection.obsWebsocket.call('GetSceneList')

        const scenesData = []

        for(const scene of scenes) {
            // @ts-ignore
            const {sceneItems} = await connection.obsWebsocket.call('GetSceneItemList', {sceneUuid: scene.sceneUuid})
            if(fullObsLog) {
                logCustom(`sources for scene ${scene.sceneName}[${scene.sceneIndex}]:`.cyan)
            }

            const sceneData = {
                index: scene.sceneIndex,
                name: scene.sceneName,
                uuid: scene.sceneUuid,
                items: []
            }

            for(const sceneItem of sceneItems) {
                if(fullObsLog) {
                    logCustom(`${sceneItem.sourceName}[${sceneItem.sceneItemId}][${sceneItem.sourceUuid}]`.blue)
                }

                sceneData.items.push({
                    id: sceneItem.sceneItemId,
                    uuid: sceneItem.sourceUuid,
                    name: sceneItem.sourceName,
                    transform: sceneItem.sceneItemTransform
                })
            }

            scenesData.push(sceneData)
        }

        connection.sceneData = scenesData

        if(connectionName === 'default') {
            // @ts-ignore
            this.sceneData = scenesData
            getWebsocketServer().send('notify_obs_scene_update', connection.sceneData)
        }

        getWebsocketServer().send('notify_obs_scene_update_named', {
            connection: connectionName,
            scenes: connection.sceneData,
        })

        if(fullObsLog) {
            logNotice(`dump all obs audio sources (${connectionName}):`)
        } else {
            logNotice(`dump all obs audio sources (${connectionName})`)
        }

        const OBS_SOURCE_AUDIO = 1 << 1

        connection.audioData = {}

        let { inputs } = await connection.obsWebsocket.call("GetInputList")

        inputs = inputs
            .filter(i => (i.inputKindCaps & OBS_SOURCE_AUDIO) !== 0)

        for(const input of inputs) {
            try {
                const volume = await connection.obsWebsocket.call("GetInputVolume", {inputUuid: input.inputUuid})
                const muted = await connection.obsWebsocket.call("GetInputMute", {inputUuid: input.inputUuid})
                const {inputAudioBalance} = await connection.obsWebsocket.call("GetInputAudioBalance", {inputUuid: input.inputUuid})

                input.volume = volume
                input.muted = muted.inputMuted
                input.balance = inputAudioBalance
            } catch (error) {
                continue
            }
            connection.audioData[input.inputUuid] = input
        }

        if(connectionName === 'default') {
            this.audioData = connection.audioData
            getWebsocketServer().send('notify_obs_audio_update', connection.audioData)
        }

        getWebsocketServer().send('notify_obs_audio_update_named', {
            connection: connectionName,
            audio: connection.audioData,
        })

        if(fullObsLog) {
            logNotice(`end of obs dump (${connectionName})`)
        }
    }

    public async reloadAllBrowserScenes(connectionName = 'default') {
        const connection = this.getConnection(connectionName)

        if(!connection?.connected || !connection.obsWebsocket) return

        logRegular(`reload all obs browser sources (${connectionName})`)

        const {inputs} = await connection.obsWebsocket.call('GetInputList', {inputKind: 'browser_source'})

        for (const input of inputs) {
            await connection.obsWebsocket.call('PressInputPropertiesButton', {
                inputUuid: input.inputUuid as string,
                propertyName: 'refreshnocache'
            })
        }
    }

    public updateAudio(inputUuid: string, data:any, connectionName = 'default') {
        const connection = this.getConnection(connectionName)

        if(!connection) return

        _.merge(connection.audioData[inputUuid], data)

        if(connectionName === 'default') {
            this.audioData = connection.audioData
            getWebsocketServer().send('notify_obs_audio_update', connection.audioData)
        }

        getWebsocketServer().send('notify_obs_audio_update_named', {
            connection: connectionName,
            audio: connection.audioData,
        })
    }
}
