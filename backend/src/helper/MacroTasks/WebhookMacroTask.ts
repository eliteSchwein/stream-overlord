import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {logRegular, logWarn} from "../LogHelper";

export default class WebhookMacroTask extends BaseMacroTask {
    channel = "webhook"

    async handle(method: string = "post", data: any = {}) {
        logRegular(`send webhook`);

        if (!data.url) {
            logWarn(`webhook requires url`);
            return;
        }

        await fetch(data.url, {
            method: String(method || "post").toUpperCase(),
            headers: {
                "Content-Type": "application/json",
                ...(data.headers ?? {}),
            },
            body: String(data.content ?? ""),
        });
    }
}
