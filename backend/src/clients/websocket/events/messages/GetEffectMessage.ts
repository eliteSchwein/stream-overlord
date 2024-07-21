import BaseMessage from "./BaseMessage";
import {getActiveEffect} from "../../../../helper/EffectHelper";

export default class GetEffectMessage extends BaseMessage {
    method = 'get_effect'

    async handle(data: any) {
        this.send('effect', getActiveEffect())
    }
}