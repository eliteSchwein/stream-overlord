import BaseMessage from "./BaseMessage";
import isShieldActive from "../../../../helper/ShieldHelper";

export default class GetShieldMessage extends BaseMessage {
    method = 'get_shield'

    async handle(data: any) {
        this.webSocket.send(JSON.stringify({
            method: 'shield_mode',
            data: {status: isShieldActive()}
        }))
    }
}