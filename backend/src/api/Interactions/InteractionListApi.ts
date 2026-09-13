import BaseApi from "../../abstracts/BaseApi";
import {getInteractionQueue} from "../../helper/InteractionHelper";

export default class InteractionListApi extends BaseApi {
    restEndpoint = "interaction/list";
    websocketMethod = "interaction_list";

    async handle(): Promise<any> {
        return {interactions: getInteractionQueue()};
    }
}
