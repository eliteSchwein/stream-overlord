import BaseApi from "../../abstracts/BaseApi";
import {reload} from "../../App";

export default class ReloadApi extends BaseApi {
    restEndpoint = 'recovery/reload'
    websocketMethod = 'reload'

    async handle(data: any): Promise<any>
    {
        await reload()
    }
}