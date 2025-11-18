import BaseApi from "../../abstracts/BaseApi";
import {logRegular} from "../../helper/LogHelper";
import {addAlert} from "../../helper/AlertHelper";

export default class AlertApi extends BaseApi {
    restEndpoint = 'alert'
    restPost = true
    websocketMethod = 'alert'

    async handle(data: any): Promise<any>
    {
        if(!data.state) return {"error": "missing state"}
        if(!data.data) return {"error": "missing data"}

        switch (data.state) {
            case 'add':
                logRegular(`add alert`)
                addAlert(data)
                break
            default:
                return {"error": "invalid state"}
        }
    }
}