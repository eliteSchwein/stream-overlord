import {getConfig} from "../../helper/ConfigHelper";
import OBSWebSocket, {EventSubscription} from "obs-websocket-js";
import {logCustom, logNotice, logRegular} from "../../helper/LogHelper";

export class OBSClient {
    obsWebsocket: OBSWebSocket
    connected = false

    public async connect() {
        const config = getConfig(/obs/g)[0]

        this.obsWebsocket = new OBSWebSocket()
        await this.obsWebsocket.connect(`ws://${config.ip}:${config.port}`, config.password, {
            eventSubscriptions: EventSubscription.All
        })
        this.connected = true
    }

    public registerEvents() {

    }

    public getOBSWebSocket() {
        return this.obsWebsocket
    }

    public async send(method: string, data: any) {
        // @ts-ignore
        await this.obsWebsocket.call(method, data)
    }

    public async getItems() {
        if(!this.connected) return

        logNotice('dump all obs scenes and items:')

        const {scenes} = await this.obsWebsocket.call('GetSceneList')

        for(const scene of scenes) {
            // @ts-ignore
            const {sceneItems} = await this.obsWebsocket.call('GetSceneItemList', {sceneUuid: scene.sceneUuid})
            logCustom(`items for scene ${scene.sceneName}[${scene.sceneIndex}]:`.cyan)

            for(const sceneItem of sceneItems) {
                logCustom(`${sceneItem.sourceName}[${sceneItem.sceneItemId}]`.blue)
            }
        }

        logNotice('end of obs dump')
    }

    public async reloadAllBrowserScenes() {
        if(!this.connected) return
        logRegular('reload all browser scenes')

        const {inputs} = await this.obsWebsocket.call('GetInputList', {inputKind: 'browser_source'})

        for (const input of inputs) {
            await this.obsWebsocket.call('PressInputPropertiesButton', {
                inputUuid: input.inputUuid as string,
                propertyName: 'refreshnocache'
            })
        }
    }
}