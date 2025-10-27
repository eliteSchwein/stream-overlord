import {toggleAutoMacro} from "../../../../helper/AutoMacroHelper";
import BaseMessage from "./BaseMessage";

export default class ToggleAutoMacroMessage extends BaseMessage {
    method = 'toggle_auto_macro'

    async handle(data: any) {
        if(!data['name'] || data['enable'] === undefined) return

        toggleAutoMacro(data['name'], data['enable'])
    }
}