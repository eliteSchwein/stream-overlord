import BaseApi from "../../abstracts/BaseApi";
import {simulateConfiguredEvent} from "../../helper/EventHelper";

export default class EventSimulateApi extends BaseApi {
    restEndpoint = "events/simulate";
    restPost = true;
    websocketMethod = "events_simulate";

    async handle(params: any = {}): Promise<any> {
        try {
            const configName = String(params?.configName ?? params?.name ?? "").trim();

            if (!configName) {
                return {error: "configName is required"};
            }

            const result = await simulateConfiguredEvent(
                configName,
                params?.event ?? params?.variables ?? {},
            );

            return {
                success: true,
                ...result,
            };
        } catch (error: any) {
            return {error: error?.message ?? "simulation failed"};
        }
    }
}
