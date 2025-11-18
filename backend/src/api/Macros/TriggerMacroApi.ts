import BaseApi from "../../abstracts/BaseApi";
import {triggerMacro} from "../../helper/MacroHelper";

export default class TriggerMacroApi extends BaseApi {
    restEndpoint = 'macro'
    restPost = true
    websocketMethod = 'trigger_macro'

    async handle(data: any): Promise<any>
    {
        if(!data.macro) return {"error": "missing macro"}

        if(!await triggerMacro(data.macro)) {
            return {"error": "macro not found"}
        }
    }
}