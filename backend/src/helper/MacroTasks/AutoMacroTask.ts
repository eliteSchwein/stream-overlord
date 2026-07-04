import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {toggleAutoMacro} from "../AutoMacroHelper";

export default class AutoMacroTask extends BaseMacroTask {
    getChannel(): string {
        return "auto_macro";
    }

    async run(channel: string, method: string, data: any = {}): Promise<any> {
        const name = data?.name ?? data?.autoMacro;

        switch (method) {
            case "enable":
            case "start":
                toggleAutoMacro(name, true);
                return true;

            case "disable":
            case "stop":
                toggleAutoMacro(name, false);
                return true;

            default:
                return false;
        }
    }
}