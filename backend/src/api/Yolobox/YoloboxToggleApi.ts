import BaseApi from "../../abstracts/BaseApi";
import {getYoloboxClient} from "../../App";
import {setYoloboxIntegrationEnabled} from "../../helper/IntegrationsHelper";

export default class YoloboxToggleApi extends BaseApi {
    restEndpoint = "yolobox/toggle";
    restPost = true;
    websocketMethod = "yolobox_toggle";

    async handle(data: any) {
        try {
            const enabled = Boolean(data.enabled ?? data.enable);

            setYoloboxIntegrationEnabled(enabled);

            if (enabled) {
                await getYoloboxClient().connect();
            } else {
                getYoloboxClient().disconnect();
            }

            return {
                status: "okay",
                enabled,
            };
        } catch (error) {
            return {
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
}
