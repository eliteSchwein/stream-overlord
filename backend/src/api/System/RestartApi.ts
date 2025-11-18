import BaseApi from "../../abstracts/BaseApi";

export default class RestartApi extends BaseApi {
    restEndpoint = 'system/restart'
    websocketMethod = 'restart'

    async handle(data: any): Promise<any>
    {
        setTimeout(() => {
            process.exit(1)
        }, 250)
    }
}