import BaseApi from "../../abstracts/BaseApi";
import {getActiveEffect} from "../../helper/EffectHelper";

export default class GetEffectApi extends BaseApi {
    restEndpoint = 'effect/get'
    websocketMethod = 'effect'

    async handle(data: any): Promise<any>
    {
        return getActiveEffect()
    }
}