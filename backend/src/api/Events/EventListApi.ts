import BaseApi from "../../abstracts/BaseApi";
import {getConfiguredEventIndex, getEventEntries, updateConfiguredEventIndex} from "../../helper/EventHelper";

export default class EventListApi extends BaseApi {
    restEndpoint = "events/list";
    restPost = true;
    websocketMethod = "events_list";

    async handle(): Promise<any> {
        try {
            return {
                events: getEventEntries(),
                configured_events: updateConfiguredEventIndex() ?? getConfiguredEventIndex(),
            };
        } catch (error: any) {
            return { error: error?.message ?? "list failed" };
        }
    }
}
