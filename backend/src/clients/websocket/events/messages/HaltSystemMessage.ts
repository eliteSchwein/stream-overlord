import BaseMessage from "./BaseMessage";
import {rebootSystem, shutdownSystem} from "../../../../helper/SystemHelper";
import {logWarn} from "../../../../helper/LogHelper";

export default class HaltSystemMessage extends BaseMessage {
    method = 'halt_system'

    async handle(data: any) {
        if(!data['target']) return

        switch (data['target']) {
            case 'reboot':
                await rebootSystem()
                break
            case 'shutdown':
                await shutdownSystem()
                break
            default:
                logWarn(`unknown halt target: ${data['target']}`)
        }
    }
}