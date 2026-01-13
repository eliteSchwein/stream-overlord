import BaseApi from "../../abstracts/BaseApi";
import {getStartupStage, isBackendReady} from "../../App";

export default class StatusApi extends BaseApi {
    restEndpoint = 'status'
    websocketMethod = 'status'

    async handle(data: any): Promise<any>
    {
        return {
            bootup_stage: getStartupStage(),
            ready: isBackendReady()
        }
    }
}