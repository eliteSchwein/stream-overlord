import BaseApi from "../../abstracts/BaseApi";
import {rebootSystem, shutdownSystem} from "../../helper/SystemHelper";
import {logWarn} from "../../helper/LogHelper";

export default class HaltSystemApi extends BaseApi {
    restEndpoint = 'system/halt'
    restPost = true
    websocketMethod = 'halt_system'

    async handle(data: any): Promise<any>
    {
        if(!data.target) return {"error": "missing target"}

        switch (data.target) {
            case 'reboot':
                await rebootSystem()
                break
            case 'halt':
                await shutdownSystem()
                break
            default:
                return {"error": "invalid target"}
        }
    }
}