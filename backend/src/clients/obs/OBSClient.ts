import {getConfig} from "../../helper/ConfigHelper";
import OBSWebSocket, {EventSubscription, OBSWebSocketError} from "obs-websocket-js";
import {
    getLogConfig,
    isDebug,
    logCustom,
    logDebug,
    logNotice,
    logRegular,
    logSuccess,
    logWarn
} from "../../helper/LogHelper";
import {updateSourceFilters} from "../../helper/SourceHelper";
import getWebsocketServer from "../../App";

export class OBSClient {
    obsWebsocket: OBSWebSocket
    connected = false
    sceneData: []
    eventFetching = false

    public async connect() {
        const config = getConfig(/obs/g)[0]

        this.connected = false
        this.sceneData = []

        await this.disconnect()

        try {
            this.obsWebsocket = new OBSWebSocket()
            await this.obsWebsocket.connect(`ws://${config.ip}:${config.port}`, config.password, {
                eventSubscriptions: EventSubscription.All
            })
        } catch (error) {
            logDebug('obs connection failed:')
            logDebug(JSON.stringify(error, Object.getOwnPropertyNames(error)))
            logWarn('reconnect obs in 5 seconds...')

            setTimeout(async () => {
                await this.connect()
            }, 5_000)

            return
        }

        this.registerEvents()

        this.connected = true

        await this.reloadAllBrowserScenes()

        await this.fetchItems()

        await updateSourceFilters()

        logSuccess('obs client is ready')
    }

    public async disconnect() {
        if(!this.obsWebsocket) return

        await this.obsWebsocket.disconnect()
    }

    public registerEvents() {
        this.obsWebsocket.on('ConnectionClosed', async (error: OBSWebSocketError) => {
            await this.handleOBSError(error)
        })
        this.obsWebsocket.on('ConnectionError', async (error: OBSWebSocketError) => {
            await this.handleOBSError(error)
        })

        // Add all events that can affect your items list
        const events = [
            // Profiles / collections
            "CurrentProfileChanged",
            "CurrentSceneCollectionChanged",
            "SceneCollectionListChanged",
            "ProfileListChanged",

            // Scene structure & names
            "SceneCreated",
            "SceneRemoved",
            "SceneNameChanged",
            "SceneListChanged",

            // Scene item lifecycle & structure
            "SceneItemCreated",
            "SceneItemRemoved",
            "SceneItemListReindexed",

            // wtf, why is obs so stupid. this specific one is for source item AND audio
            "InputNameChanged",
        ];

        events.forEach(event =>
            // @ts-ignore
            this.obsWebsocket.on(event, async () => {
                if(this.eventFetching) return
                this.eventFetching = true
                await this.fetchItems()
                this.eventFetching = false
            })
        );

    }

    private async handleOBSError(error: OBSWebSocketError) {
        logWarn(`obs disconnect: ${error.code} ${error.message}`)

        if(!this.connected) return

        this.connected = false

        await updateSourceFilters()

        logWarn('reconnect obs now...')

        await this.connect()
    }

    public getSceneData() {
        return this.sceneData
    }

    public getOBSWebSocket() {
        return this.obsWebsocket
    }

    public getSceneItemByUuid(uuid: string) {
        for (const scene of this.sceneData) {
            // @ts-ignore
            for (const sceneItem of scene.items) {
                if(sceneItem.uuid !== uuid) continue

                const clonedSceneItem = Object.assign({}, sceneItem)
                clonedSceneItem.scene = scene

                return clonedSceneItem
            }
        }

        return undefined
    }

    public async send(method: string, data: any) {
        // @ts-ignore
        await this.obsWebsocket.call(method, data)
    }

    public async fetchItems() {
        if(!this.connected) return

        const fullObsLog = getLogConfig().full_obs_log

        if(fullObsLog) {
            logNotice('dump all obs scenes and items:')
        } else {
            logNotice('dump all obs scenes and items')
        }

        const {scenes} = await this.obsWebsocket.call('GetSceneList')

        const scenesData = []

        for(const scene of scenes) {
            // @ts-ignore
            const {sceneItems} = await this.obsWebsocket.call('GetSceneItemList', {sceneUuid: scene.sceneUuid})
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

        // @ts-ignore
        this.sceneData = scenesData

        getWebsocketServer().send('notify_obs_scene_update', this.sceneData)

        if(fullObsLog) {
            logNotice('end of obs dump')
        }
    }

    public async reloadAllBrowserScenes() {
        if(!this.connected) return

        logRegular('reload all obs browser sources')

        const {inputs} = await this.obsWebsocket.call('GetInputList', {inputKind: 'browser_source'})

        for (const input of inputs) {
            await this.obsWebsocket.call('PressInputPropertiesButton', {
                inputUuid: input.inputUuid as string,
                propertyName: 'refreshnocache'
            })
        }
    }
}