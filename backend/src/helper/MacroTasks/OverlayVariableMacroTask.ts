import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {logRegular, logWarn} from "../LogHelper";

/**
 * Pushes a value to overlay variable controllers without storing it as a bot
 * variable. Useful for local macro values; stored variables (variable set)
 * reach the overlay automatically through notify_variables_update.
 */
export default class OverlayVariableMacroTask extends BaseMacroTask {
    channel = "overlay_variable"

    async handle(method: string, data: any = {}) {
        if (method !== "show") {
            logWarn(`invalid overlay_variable method: ${method}`)
            return
        }

        const key = String(data.key ?? "").trim()

        if (!key) {
            logWarn(`overlay_variable show requires key`)
            return
        }

        logRegular(`overlay variable show ${key}=${JSON.stringify(data.value)}`)

        this.websocket.send("notify_overlay_variable", {
            key,
            value: data.value ?? null,
        })
    }
}
