import BaseMessage from "./BaseMessage";
import {logDebug} from "../../../../helper/LogHelper";
import {sendVirtualAudioCableState} from "../../../../helper/VirtualAudioCableHelper";

/**
 * Registers an audio-only overlay for virtual-cable signaling/state.
 *
 * Actual media is NOT transported through this WebSocket. The client receives
 * MediaMTX/WHEP metadata via notify_virtual_audio_cables and opens WebRTC itself.
 */
export default class RegisterVirtualAudioCableMessage extends BaseMessage {
    method = 'register_virtual_audio_cable'

    async handle(data: any) {
        this.client.addConnection(this.webSocket, ['notify_virtual_audio_cables'])

        const cable = String(data?.cable ?? '').trim()
        logDebug(
            `virtual audio signaling registered: ${this.webSocket._socket.remoteAddress}:${this.webSocket._socket.remotePort}`
            + (cable ? ` cable=${cable}` : '')
        )

        sendVirtualAudioCableState(this.webSocket)
    }
}
