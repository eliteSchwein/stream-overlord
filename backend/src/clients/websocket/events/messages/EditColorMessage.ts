import BaseMessage from "./BaseMessage";
import {pushTheme, setManual} from "../../../../helper/ThemeHelper";

export default class EditColorMessage extends BaseMessage {
    method = 'set_color'

    async handle(data: any) {
        const color = data.color

        setManual(color)
        pushTheme()
    }
}