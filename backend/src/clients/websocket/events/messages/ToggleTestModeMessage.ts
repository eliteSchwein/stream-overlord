import BaseMessage from "./BaseMessage";
import {getAdData} from "../../../website/WebsiteClient";
import {logWarn} from "../../../../helper/LogHelper";
import {setTestModeActive} from "../../../../helper/VisibleHelper";

export default class ToggleTestModeMessage extends BaseMessage {
    method = 'toggle_test_mode'

    async handle(data: any) {
        setTestModeActive(data.active)
    }
}