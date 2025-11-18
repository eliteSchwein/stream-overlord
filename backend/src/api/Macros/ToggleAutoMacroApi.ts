import BaseApi from "../../abstracts/BaseApi";
import {toggleAutoMacro} from "../../helper/AutoMacroHelper";

export default class ToggleAutoMacroApi extends BaseApi {
    restEndpoint = 'macro/toggle_auto'
    restPost = true
    websocketMethod = 'toggle_auto_macro'

    async handle(data: any): Promise<any>
    {
        if(!data['name'] || data['enable'] === undefined) return {"error": "missing parameters"}

        toggleAutoMacro(data['name'], data['enable'])
    }
}