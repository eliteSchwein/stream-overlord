import BaseMessage from "./BaseMessage";
import {setTestModeActive} from "../../../../helper/VisibleHelper";

export default class ToggleTestModeMessage extends BaseMessage {
    method = 'toggle_test_mode'

    async handle(data: any) {
        setTestModeActive(data.active)
    }
}