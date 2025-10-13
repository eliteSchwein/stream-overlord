import BaseMessage from "./BaseMessage";
import {writeRawConfig} from "../../../../helper/ConfigHelper";

export default class UpdateConfigMessage extends BaseMessage {
    method = 'update_config'

    async handle(data: any) {
        const newConfig = data.data

        writeRawConfig(newConfig)
    }
}