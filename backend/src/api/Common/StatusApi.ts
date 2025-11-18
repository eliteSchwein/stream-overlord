import BaseApi from "../../abstracts/BaseApi";

export default class StatusApi extends BaseApi {
    restEndpoint = 'status'
    websocketMethod = 'status'

    async handle(data: any): Promise<any>
    {
        return {
            status: 'ok'
        }
    }
}