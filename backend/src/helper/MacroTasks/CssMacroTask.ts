import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {logRegular, logWarn} from "../LogHelper";
import {applyCssOverride, CssOverrideAction} from "../CssOverrideHelper";

const METHODS: CssOverrideAction[] = ["set", "append", "reset"];

export default class CssMacroTask extends BaseMacroTask {
    channel = "css"

    async handle(method: string, data: any = {}) {
        if (!METHODS.includes(method as CssOverrideAction)) {
            logWarn(`invalid css method: ${method}`)
            return
        }

        const action = method as CssOverrideAction
        const selector = String(data.selector ?? "").trim() || null
        const css = String(data.css ?? "").trim()

        if (action !== "reset" && !selector) {
            logWarn(`css ${action} requires selector`)
            return
        }

        applyCssOverride(action, selector, css)

        logRegular(`css ${action}: ${selector ?? "*"} ${css}`)

        this.websocket.send("notify_css_update", {
            action,
            selector,
            css,
        })
    }
}
