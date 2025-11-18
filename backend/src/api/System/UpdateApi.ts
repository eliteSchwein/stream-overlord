import BaseApi from "../../abstracts/BaseApi";
import {selfUpdate} from "../../helper/SystemHelper";

export default class UpdateApi extends BaseApi {
    restEndpoint = 'system/update'
    websocketMethod = 'update_system'

    async handle(data: any): Promise<any>
    {
        await selfUpdate()
    }
}