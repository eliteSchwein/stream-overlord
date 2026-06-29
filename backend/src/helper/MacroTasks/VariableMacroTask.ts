import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {getVariable, setVariable} from "../VariableHelper";
import {logRegular, logWarn} from "../LogHelper";

export default class VariableMacroTask extends BaseMacroTask {
    channel = "variable"

    async handle(method: string, data: any = {}, variables: any = {}) {
        const key = data.key;

        if (!key) {
            logWarn(`variable ${method} requires key`);
            return;
        }

        switch (method) {
            case "get": {
                const value = await getVariable(key);
                variables[key] = value;

                logRegular(`variable get ${key}=${JSON.stringify(value)}`);
                break;
            }

            case "set": {
                if (data.value === undefined) {
                    logWarn(`variable set requires value`);
                    break;
                }

                await setVariable(key, data.value, data.to_file === true || data.toFile === true);
                variables[key] = data.value;

                logRegular(`variable set ${key}=${JSON.stringify(data.value)}`);
                break;
            }

            default: {
                logWarn(`invalid variable method: ${method}`);
                break;
            }
        }
    }
}
