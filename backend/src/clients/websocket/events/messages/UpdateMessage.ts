import BaseMessage from "./BaseMessage";
import {selfUpdate} from "../../../../helper/SystemHelper";

export default class UpdateMessage extends BaseMessage {
    method = 'update'

    async handle(data: any) {
        await selfUpdate()
    }
}