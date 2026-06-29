import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {logWarn} from "../LogHelper";

type MacroRuntime = {
    isMacroPresent: (name: string) => boolean
    triggerMacro: (name: string, variables?: any) => Promise<boolean>
}

export default class MacroMacroTask extends BaseMacroTask {
    channel = "macro"

    constructor(private runtime: MacroRuntime) {
        super();
    }

    async handle(method: string, data: any = {}, variables: any = {}) {
        if (!this.runtime.isMacroPresent(method)) {
            logWarn(`macro task skipped, macro not found: ${method}`);
            return;
        }

        await this.runtime.triggerMacro(method, variables);
    }
}
