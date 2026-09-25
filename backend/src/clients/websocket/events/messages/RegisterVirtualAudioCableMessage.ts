import BaseMessage from "./BaseMessage";
import {logDebug} from "../../../../helper/LogHelper";

/**
 * Registers a websocket connection as a virtual-audio stream listener.
 *
 * This is intentionally just an alias for subscribing to notify_audio_stream.
 * The cable id remains part of the stream payload and is filtered by the
 * overlay client, so one websocket endpoint can carry all configured cables.
 */
export default class RegisterVirtualAudioCableMessage extends BaseMessage {
    method = 'register_virtual_audio_cable'

    async handle(data: any) {
        // Registering the notify endpoint is what keeps an audio-only websocket
        // alive in ConnectEvent's "registered in time" check.
        this.client.addConnection(this.webSocket, ['notify_audio_stream'])

        const cable = String(data?.cable ?? '').trim()
        logDebug(
            `virtual audio websocket registered: ${this.webSocket._socket.remoteAddress}:${this.webSocket._socket.remotePort}`
            + (cable ? ` cable=${cable}` : '')
        )
    }
}
