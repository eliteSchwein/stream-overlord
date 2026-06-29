import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {logRegular} from "../LogHelper";

export default class WebsocketMacroTask extends BaseMacroTask {
    channel = "websocket"

    async handle(method: string, data: any = {}) {
        logRegular(`trigger websocket: ${method}`);

        this.websocket.send(method, data);
    }
}
