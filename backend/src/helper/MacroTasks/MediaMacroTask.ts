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

                this.websocket.send("notify_media_update", {
                    media: method,
                    path: data.path,
                    options: data.options ?? {},
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
