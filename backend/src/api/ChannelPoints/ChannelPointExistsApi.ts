import BaseApi from "../../abstracts/BaseApi";
import {isChannelPointPresent} from "../../helper/ChannelPointHelper";

export default class ChannelPointExistsApi extends BaseApi {
    restEndpoint = "channel_points/exists";
    restPost = true;
    websocketMethod = "channel_points_exists";

    async handle(data: any): Promise<any> {
        const name = String(data?.name ?? "").trim();

        if (!name) {
            return {error: "channel point name is required"};
        }

        return {
            name,
            exists: isChannelPointPresent(name),
        };
    }
}
