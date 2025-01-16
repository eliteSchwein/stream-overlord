import BaseMessage from "./BaseMessage";
import {pushGameInfo, setManualColor} from "../../../../helper/GameHelper";

export default class EditColorMessage extends BaseMessage {
    method = 'set_color'

    async handle(data: any) {
        const color = data.color

        setManualColor(color)
        pushGameInfo()
    }
}