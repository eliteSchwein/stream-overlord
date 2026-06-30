import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {logRegular, logWarn} from "../LogHelper";

export default class MediaMacroTask extends BaseMacroTask {
    channel = "media"

    async handle(method: string, data: any = {}) {
        logRegular(`trigger media: ${method}`);

        switch (method) {
            case "show_media": {
                if (!data.path) {
                    logWarn(`media show_media requires path`);
                    break;
                }

                const options = data.options && typeof data.options === "object"
                    ? data.options
                    : {};

                this.websocket.send("notify_media_update", {
                    media: method,
                    ...options,
                    target: data.target ?? options.target ?? "default",
                    path: data.path,
                    type: data.type ?? options.type,
                    clearOnEmpty: data.clearOnEmpty ?? options.clearOnEmpty,
                    autoplay: data.autoplay ?? options.autoplay,
                    loop: data.loop ?? options.loop,
                    muted: data.muted ?? options.muted,
                    controls: data.controls ?? options.controls,
                });

                break;
            }

            default: {
                logWarn(`invalid media method: ${method}`);
                break;
            }
        }
    }
}
