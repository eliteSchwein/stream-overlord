import BaseApi from "../../abstracts/BaseApi";
import {cancelInteraction} from "../../helper/InteractionHelper";
import {removeAlertByEventUuid} from "../../helper/AlertHelper";

export default class RemoveInteractionApi extends BaseApi {
    restEndpoint = "interaction/remove";
    restPost = true;
    websocketMethod = "remove_interaction";

    async handle(data: any): Promise<any> {
        const uuid = String(data?.uuid ?? data?.eventUuid ?? data?.["event-uuid"] ?? "").trim();
        if (!uuid) return {error: "missing uuid"};

        removeAlertByEventUuid(uuid);
        return {removed: cancelInteraction(uuid)};
    }
}
