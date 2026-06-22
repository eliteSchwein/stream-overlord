import BaseApi from "../../abstracts/BaseApi";
import {getConfiguredChannelPoints, listChannelPointFiles} from "../../helper/ChannelPointHelper";

export default class ChannelPointListApi extends BaseApi {
    restEndpoint = "channel_points/list";
    restPost = true;
    websocketMethod = "channel_points_list";

    async handle(): Promise<any> {
        try {
            return {
                files: listChannelPointFiles(),
                channel_points: getConfiguredChannelPoints(),
            };
        } catch (error: any) {
            return { error: error?.message ?? "list failed" };
        }
    }
}
