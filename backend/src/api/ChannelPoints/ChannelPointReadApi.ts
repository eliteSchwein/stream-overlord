import BaseApi from "../../abstracts/BaseApi";
import {readChannelPointFile} from "../../helper/ChannelPointHelper";

export default class ChannelPointReadApi extends BaseApi {
    restEndpoint = "channel_points/read";
    restPost = true;
    websocketMethod = "channel_points_read";

    async handle(data: any): Promise<any> {
        try {
            return {
                status: "okay",
                ...readChannelPointFile(data?.path ?? data?.file ?? data?.name),
            };
        } catch (error: any) {
            return { error: error?.message ?? "read failed" };
        }
    }
}
