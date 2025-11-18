import {writeRawConfig} from "../../helper/ConfigHelper";
import BaseApi from "../../abstracts/BaseApi";

export default class UpdateConfigApi extends BaseApi{
    restEndpoint = 'config/update'
    restPost = true
    websocketMethod = 'update_config'

    async handle(data: any): Promise<any>
    {
        const newConfig = data.data

        writeRawConfig(newConfig)
    }
}