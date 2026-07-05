import BaseApi from "../../abstracts/BaseApi";
import {addNeopixelIntegration} from "../../helper/IntegrationsHelper";
import {initNeopixels} from "../../helper/NeopixelHelper";

export default class NeopixelAddApi extends BaseApi {
    restEndpoint = "neopixel/add";
    restPost = true;
    websocketMethod = "neopixel_add";

    async handle(data: any) {
        try {
            const name = String(data.name ?? "").trim();

            addNeopixelIntegration(name, {
                gpio: Number(data.gpio),
                amount: Number(data.amount),
                heartbeat_index: data.heartbeat_index === undefined || data.heartbeat_index === null || String(data.heartbeat_index).trim() === ""
                    ? undefined
                    : Number(data.heartbeat_index),
            });

            await initNeopixels();

            return {status: "okay"};
        } catch (error) {
            return {
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
}
