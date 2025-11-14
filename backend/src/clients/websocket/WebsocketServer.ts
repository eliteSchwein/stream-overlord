import {WebSocketServer} from "ws";
import {getConfig, getRawConfig} from "../../helper/ConfigHelper";
import {logError, logRegular, logWarn} from "../../helper/LogHelper";
import ConnectEvent from "./events/ConnectEvent";
import {getRandomInt} from "../../../../helper/GeneralHelper";
import isShieldActive from "../../helper/ShieldHelper";
import {getActiveChannelPoints} from "../../helper/ChannelPointHelper";
import {getAudioData} from "../../helper/AudioHelper";
import {getSystemInfo} from "../../helper/SystemInfoHelper";
import {getSourceFilters} from "../../helper/SourceHelper";
import {getOBSClient, getTauonmbClient} from "../../App";
import getGameInfo from "../../helper/GameHelper";
import {getAllVisibleElements, isTestModeActive, toggleElementVisiblity} from "../../helper/VisibleHelper";
import {getVoices} from "../../helper/TTShelper";
import {getMacros} from "../../helper/MacroHelper";
import {getAutoMacros} from "../../helper/AutoMacroHelper";
import {getTemplateVariables} from "../../helper/TemplateHelper";
import {getGiveaway} from "../../helper/GiveawayHelper";
import BaseApi from "../../abstracts/BaseApi";


export default class WebsocketServer {
    websocket: WebSocketServer
    validEndpoints: string[] = [
        'notify_alert',
        'notify_alert_query',
        'notify_ads',
        'notify_effect',
        'notify_toggle_element',
        'notify_shoutout_clip',
        'notify_tauonmb_update',
        'notify_source_update',
        'notify_system_info',
        'notify_audio_update',
        'notify_channel_point_update',
        'notify_shield_mode',
        'notify_game_update',
        'notify_throttle',
        'notify_timer',
        'trigger_keyboard',
        'notify_visible_element',
        'notify_connection',
        'notify_config_update',
        'notify_obs_scene_update',
        'notify_tauonmb_show',
        'notify_test_mode',
        'notify_power_button',
        'notify_voice_list_update',
        'notify_macro_update',
        'notify_auto_macros_update',
        'notify_variables_update',
        'notify_giveaway_update'
    ]
    connectionEndpoints = {}
    messageEvents: BaseApi[] = []
    
    public initial() {
        const config = getConfig(/websocket/g)[0]

        logRegular(`initial websocket server`)

        this.websocket = new WebSocketServer({port: config.port, host: '0.0.0.0', maxPayload: 512 * 1024 * 1024})
    }

    public registerEvents() {
        void new ConnectEvent(this.websocket, this).register()
    }

    public getWebsocket() {
        return this.websocket
    }

    public send(method: string, data: any = {}, connection?: WebSocket) {
        if(method === 'notify_visible_element') {
            toggleElementVisiblity(data.target, data.state)
        }

        // @ts-ignore
        const targets = connection  ? [connection] : [...this.websocket.clients]

        targets.forEach((client) => {
            try {
                const clientKey = `${client._socket.remoteAddress}:${client._socket.remotePort}`
                const allowed = this.connectionEndpoints[clientKey]

                if (!allowed || !allowed.includes(method)) return

                client.send(JSON.stringify({
                    jsonrpc: "2.0",
                    method,
                    params: data,
                    id: getRandomInt(10_000)
                }))
            } catch (error) {
                logError("request to a websocket client failed!")
                logError(JSON.stringify(error, Object.getOwnPropertyNames(error)))
            }
        })
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
        for (const ep of validNewEndpoints) {
            if (!this.connectionEndpoints[client].includes(ep)) {
                this.connectionEndpoints[client].push(ep)
            }
        }

        this.sendUpdate(connection)

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

    public isConnectionRegistered(client: string): boolean {
        return Object.keys(this.connectionEndpoints).includes(client)
    }

    public sendUpdate(connection?: WebSocket) {
        // @ts-ignore
        const targets = connection ? [connection] : [...this.websocket.clients]

        targets.forEach((client) => {
            try {
                this.send("notify_shield_mode", {
                    action: isShieldActive() ? "enable" : "disable"
                }, client)

                this.send("notify_game_update", getGameInfo(), client)
                this.send("notify_channel_point_update", getActiveChannelPoints(), client)
                this.send("notify_audio_update", getAudioData(), client)
                this.send("notify_system_info", getSystemInfo(), client)
                this.send("notify_source_update", getSourceFilters(), client)
                this.send("notify_tauonmb_update", getTauonmbClient()?.getStatus(), client)
                this.send("notify_connection", this.getConnections(), client)
                this.send("notify_obs_scene_update", getOBSClient().getSceneData(), client)
                this.send("notify_config_update", {data: getRawConfig()}, client)
                this.send("notify_test_mode", {active: isTestModeActive()}, client)
                this.send("notify_voice_list_update", {voices: getVoices()}, client)
                this.send("notify_macro_update", {macros: getMacros()}, client)
                this.send("notify_auto_macros_update", getAutoMacros(), client)
                this.send("notify_variables_update", getTemplateVariables(), client)
                this.send("notify_giveaway_update", getGiveaway(), client)

                for(const id in getAllVisibleElements()) {
                    const state = getAllVisibleElements()[id]

                    this.send("notify_visible_element", {target: id, state: state}, client)
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
}