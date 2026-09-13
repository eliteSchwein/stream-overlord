import BaseApi from "../../abstracts/BaseApi";
import {logRegular} from "../../helper/LogHelper";
import {addAlert} from "../../helper/AlertHelper";
import {enqueueInteraction} from "../../helper/InteractionHelper";

export default class AlertApi extends BaseApi {
    restEndpoint = "alert";
    restPost = true;
    websocketMethod = "alert";

    async handle(data: any): Promise<any> {
        if (data?.state && data.state !== "add") return {error: "invalid state"};

        const payload = data?.data && typeof data.data === "object" ? data.data : data;
        if (!payload) return {error: "missing data"};

        logRegular("queue legacy alert interaction");
        const interaction = enqueueInteraction({
            name: String(payload.name ?? payload.asset ?? payload.message ?? "API Alert"),
            source: "api",
            estimatedDuration: Number(payload.duration ?? 0) || 0,
            execute: current => {
                addAlert({
                    ...payload,
                    interaction_uuid: current.uuid,
                    "event-uuid": payload["event-uuid"] ?? current.uuid,
                    variables: {
                        ...(payload.variables ?? {}),
                        eventUuid: payload["event-uuid"] ?? current.uuid,
                        interactionUuid: current.uuid,
                    },
                });
            },
        });

        return {interaction};
    }
}
