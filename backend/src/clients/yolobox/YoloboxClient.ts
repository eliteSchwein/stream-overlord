import {getConfig} from "../../helper/ConfigHelper";
import {logDebug, logSuccess, logWarn} from "../../helper/LogHelper";
import {scanDeviceWithPort} from "../../helper/NetworkHelper";
import {Websocket, WebsocketEvent} from "websocket-ts";
import waitUntil from "async-wait-until";
import getWebsocketServer from "../../App";

export class YoloboxClient {
    protected connected = false

    protected connectedDevice = ''

    protected authEndpoint = '/remote/controller/authenticate'
    protected commandEndpoint = '/remote/controller/postOrder'
    protected heartbeatEndpoint = '/remote/controller/heartbeat'
    protected dataEndpoints = [
        "/remote/controller/getDirectorList",
        "/remote/controller/getMaterialList",
        "/remote/controller/getMixerList",
        "/remote/controller/getLiveStatus"
    ]

    protected websocketConnections: Websocket[] = []
    protected commandConnection: Websocket = null
    protected heartbeatConnection: Websocket = null

    protected data: any = {}

    public async connect()
    {
        const config = getConfig(/yolobox/g)[0]

        this.connected = false
        this.connectedDevice = ''
        this.data = {}

        if(this.commandConnection) {
            for(const connection of this.websocketConnections) {
                connection.close()
            }
            this.commandConnection.close()
            this.heartbeatConnection.close()

            this.websocketConnections = []
            this.commandConnection = null
            this.heartbeatConnection = null
        }

        if(!config || !config.enable) {
            logDebug("Yolobox Config not found, disable Yolobox Client")
            return
        }

        const additionalDevices = config.additionalDevices ?? []
        const foundDevices = await scanDeviceWithPort(8887, additionalDevices)

        if(foundDevices.length === 0){
            logDebug("no yolobox devices found, retry in 5 sec")
            setTimeout(async () => {
                await this.connect()
            }, 5_000)
            return
        }

        for(const device of foundDevices){
            if(this.connectedDevice !== '') continue

            const testConnection = await this.connectEndpoint(this.authEndpoint, device)

            if(!testConnection) continue

            this.websocketConnections.push(testConnection)
            this.connectedDevice = device
            await this.initConnections()
        }

        if(this.connectedDevice !== '') {
            logSuccess(`Yolobox ${this.connectedDevice} connected`)
            return
        }

        logDebug("no yolobox devices found, retry in 5 sec")
        setTimeout(async () => {
            await this.connect()
        }, 5_000)
    }

    private async initConnections()
    {
        this.websocketConnections.push(await this.connectEndpoint(this.authEndpoint))
        this.heartbeatConnection = await this.connectEndpoint(this.heartbeatEndpoint)
        this.commandConnection = await this.connectEndpoint(this.commandEndpoint)

        for(const targetEndpoint of this.dataEndpoints) {
            const websocket = await this.connectEndpoint(targetEndpoint, this.connectedDevice, true)
            websocket.addEventListener(WebsocketEvent.message, (ws, event) => {
                const data = JSON.parse(event.data)
                if(!data || data.code !== 200) return

                const dataKey = data.data.api.replace('/remote/controller/get', '')

                this.data.http = `http://${this.connectedDevice}:8080`
                this.data.ws = `ws://${this.connectedDevice}:8080`
                this.data[dataKey] = data.data.result

                getWebsocketServer().send('notify_yolobox_update', this.data)
            })

            this.websocketConnections.push(websocket)
        }

        this.connected = true
    }

    public async checkConnection()
    {
        if(!this.connected) return
        if(!this.heartbeatConnection) return

        let heartbeat = false

        const handleData = (ws, data) => {
            heartbeat = true
        }

        this.heartbeatConnection.addEventListener(WebsocketEvent.message, handleData)

        this.heartbeatConnection.send(JSON.stringify({alive: true}))

        try {
            await waitUntil(() => heartbeat, {timeout: 200})
        } catch (e) {

        }

        logDebug("check heartbeat yolobox")

        this.heartbeatConnection?.removeEventListener(WebsocketEvent.message, handleData)

        if(!heartbeat) {
            void this.connect()
            return false;
        }

        return heartbeat
    }

    public sendCommand(data: any) {
        if(!this.connected) return
        if(!this.commandConnection) return

        this.commandConnection.send(JSON.stringify(data))
    }

    public getData() {
        return this.data
    }

    private async connectEndpoint(endpoint: string, device: string = this.connectedDevice, skipCheck = false) {
        logDebug(`connect yolobox endpoint: ${endpoint}`)
        const websocket = new Websocket(`ws://${device}:8887${endpoint}`);

        if(skipCheck) return websocket

        let isConnected = false;
        let isValid = false;
        let isInvalid = false;

        const handleOpen = () => {
            isConnected = true;
        };
        const handleError = () => {
            isInvalid = true;
        };
        const handleClose = () => {
            isInvalid = true;
        };
        const handleMessage = (connectedWebsocket: Websocket, event: any) => {
            const data = JSON.parse(event.data);
            if (data) isValid = true;
        };

        websocket?.addEventListener(WebsocketEvent.open, handleOpen);
        websocket?.addEventListener(WebsocketEvent.error, handleError);
        websocket?.addEventListener(WebsocketEvent.close, handleClose);
        websocket?.addEventListener(WebsocketEvent.message, handleMessage);

        try {
            await waitUntil(() => isValid || isInvalid, {timeout: 2_000});
        } catch (e) {

        }

        websocket?.removeEventListener(WebsocketEvent.open, handleOpen);
        websocket?.removeEventListener(WebsocketEvent.error, handleError);
        websocket?.removeEventListener(WebsocketEvent.close, handleClose);
        websocket?.removeEventListener(WebsocketEvent.message, handleMessage);

        if (isInvalid && !isConnected) {
            websocket.close();
            return null;
        }

        return websocket;
    }

    public getIp() {
        return this.connectedDevice
    }
}