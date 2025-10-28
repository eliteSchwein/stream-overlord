import BaseMessage from "./BaseMessage";
import {startGiveaway, stopGiveaway} from "../../../../helper/GiveawayHelper";

export default class StopGiveawayMessage extends BaseMessage {
    method = 'stop_giveaway'

    async handle(data: any) {
        await stopGiveaway()
    }
}