import BaseApi from "../../abstracts/BaseApi";
import {editChannelPointFile} from "../../helper/ChannelPointHelper";

export default class ChannelPointEditApi extends BaseApi {
    restEndpoint = "channel_points/edit";
    restPost = true;
    websocketMethod = "channel_points_edit";

    async handle(data: any): Promise<any> {
        try {
            return {
                status: "okay",
                ...editChannelPointFile(data?.path ?? data?.file ?? data?.name, data?.content ?? ""),
            };
        } catch (error: any) {
            return { error: error?.message ?? "edit failed" };
        }
    }
}
