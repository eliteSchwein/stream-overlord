import BaseMessage from "./BaseMessage";
import isShieldActive from "../../../../helper/ShieldHelper";

export default class GetShieldMessage extends BaseMessage {
    method = 'get_shield'

    async handle(data: any) {
        this.send('shield_mode', {status: isShieldActive()})
    }
}