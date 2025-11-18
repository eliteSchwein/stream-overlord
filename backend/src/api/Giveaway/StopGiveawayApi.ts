import BaseApi from "../../abstracts/BaseApi";
import {stopGiveaway} from "../../helper/GiveawayHelper";

export default class StopGiveawayApi extends BaseApi {
    restEndpoint = 'giveaway/stop'
    websocketMethod = 'stop_giveaway'

    async handle(data: any): Promise<any>
    {
        await stopGiveaway()
    }
}