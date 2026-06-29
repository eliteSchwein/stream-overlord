import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {colorNeopixel} from "../NeopixelHelper";
import {logWarn} from "../LogHelper";

export default class NeopixelMacroTask extends BaseMacroTask {
    channel = "neopixel"

    async handle(method: string, data: any = {}) {
        if (method !== "color") {
            logWarn(`invalid neopixel method`);
            return;
        }

        if (!data.name) {
            logWarn(`neopixel name missing`);
            return;
        }

        if (!data.color) {
            logWarn(`neopixel color missing`);
            return;
        }

        await colorNeopixel(data.name, data.color, data.index);
    }
}
