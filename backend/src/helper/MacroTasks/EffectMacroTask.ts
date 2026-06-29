import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {logRegular} from "../LogHelper";

export default class EffectMacroTask extends BaseMacroTask {
    channel = "effect"

    async handle(method: string, data: any = {}) {
        logRegular(`trigger effect: ${method}`)

        this.websocket.send('notify_effect', {
            target: data.target,
            effect: method,
            content: data.content ?? '',
            options: data.options ?? {},
        })
    }
}
