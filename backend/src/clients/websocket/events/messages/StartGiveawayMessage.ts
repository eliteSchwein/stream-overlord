import BaseMessage from "./BaseMessage";
import {startGiveaway} from "../../../../helper/GiveawayHelper";

export default class StartGiveawayMessage extends BaseMessage {
    method = 'start_giveaway'

    async handle(data: any) {
        if(!data['content']) return
        if(!data['duration']) return
        if(Number.isNaN(Number(data['duration']))) return

        await startGiveaway(data['content'], Number(data['duration']))
    }
}