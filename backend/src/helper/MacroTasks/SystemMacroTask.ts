import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {rebootSystem, shutdownSystem} from "../SystemHelper";
import {logRegular, logWarn} from "../LogHelper";

export default class SystemMacroTask extends BaseMacroTask {
    channel = "system"

    async handle(method: string, data: any = {}, variables: any = {}) {
        switch (method) {
            case "reboot":
            case "restart": {
                logRegular(`system macro: triggering reboot`);
                await rebootSystem();
                break;
            }

            case "shutdown":
            case "halt":
            case "poweroff": {
                logRegular(`system macro: triggering shutdown`);
                await shutdownSystem();
                break;
            }

            default: {
                logWarn(`invalid system method: ${method}`);
                break;
            }
        }
    }
}