import BaseApi from "../../abstracts/BaseApi";
import {deleteChannelPointFile} from "../../helper/ChannelPointHelper";

export default class ChannelPointDeleteApi extends BaseApi {
    restEndpoint = "channel_points/delete";
    restPost = true;
    websocketMethod = "channel_points_delete";

    async handle(data: any): Promise<any> {
        try {
            return {
                status: "okay",
                ...deleteChannelPointFile(data?.path ?? data?.file ?? data?.name),
            };
        } catch (error: any) {
            return { error: error?.message ?? "delete failed" };
        }
    }
}
