import BaseApi from "../../abstracts/BaseApi";
import {getYoloboxClient} from "../../App";

export default class YoloboxExecuteApi extends BaseApi {
    restEndpoint = 'yolobox/execute'
    restPost = true
    websocketMethod = 'execute_yolobox'

    async handle(data: any): Promise<any> {
        if(!data.orderID) {
            return {error: 'Order ID is required'};
        }
        if(!data.data) {
            return {error: 'Data is required'};
        }
        getYoloboxClient().sendCommand(data)
    }
}