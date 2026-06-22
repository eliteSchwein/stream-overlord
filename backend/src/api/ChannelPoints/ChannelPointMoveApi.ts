import BaseApi from "../../abstracts/BaseApi";
import {moveChannelPointFile} from "../../helper/ChannelPointHelper";

export default class ChannelPointMoveApi extends BaseApi {
    restEndpoint = "channel_points/move";
    restPost = true;
    websocketMethod = "channel_points_move";

    async handle(data: any): Promise<any> {
        try {
            return {
                status: "okay",
                ...moveChannelPointFile(data?.source, data?.target),
            };
        } catch (error: any) {
            return { error: error?.message ?? "move failed" };
        }
    }
}
