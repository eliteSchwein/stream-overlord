import BaseApi from "../../abstracts/BaseApi";
import {startGiveaway} from "../../helper/GiveawayHelper";

export default class StartGiveawayApi extends BaseApi {
    restEndpoint = 'giveaway/start'
    restPost = true
    websocketMethod = 'start_giveaway'

    async handle(data: any): Promise<any>
    {
        if(!data.content) return {"error": "missing content"}
        if(!data.duration) return {"error": "missing duration"}
        if(Number.isNaN(Number(data.duration))) return {"error": "duration must be a number"}

        await startGiveaway(data.content, Number(data.duration))
    }
}