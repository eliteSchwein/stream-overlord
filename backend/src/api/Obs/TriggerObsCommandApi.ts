import BaseApi from "../../abstracts/BaseApi";

export default class TriggerObsCommandApi extends BaseApi {
    restEndpoint = 'obs'
    restPost = true
    websocketMethod = 'obs_trigger_command'

    async handle(data: any): Promise<any>
    {

    }
}