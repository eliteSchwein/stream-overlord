import BaseApi from "../../abstracts/BaseApi";
import {removeNeopixelIntegration} from "../../helper/IntegrationsHelper";
import {initNeopixels} from "../../helper/NeopixelHelper";

export default class NeopixelRemoveApi extends BaseApi {
    restEndpoint = "neopixel/remove";
    restPost = true;
    websocketMethod = "neopixel_remove";

    async handle(data: any) {
        try {
            const name = String(data.name ?? "").trim();

            removeNeopixelIntegration(name);
            await initNeopixels();

            return {status: "okay"};
        } catch (error) {
            return {
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
}
