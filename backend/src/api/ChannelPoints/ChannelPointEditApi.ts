import BaseApi from "../../abstracts/BaseApi";
import {editChannelPointFile, updateChannelPoints} from "../../helper/ChannelPointHelper";

export default class ChannelPointEditApi extends BaseApi {
    restEndpoint = "channel_points/edit";
    restPost = true;
    websocketMethod = "channel_points_edit";

    async handle(data: any): Promise<any> {
        try {
            const channelPoint = data?.channel_point ?? data?.channelPoint ?? {};

            const result = editChannelPointFile(
                data?.path ?? data?.file ?? data?.name,
                data?.content ?? "",
                {
                    label: data?.label ?? channelPoint?.label,
                    name: data?.configName ?? data?.channelPointName ?? data?.name ?? channelPoint?.name ?? channelPoint?.label,
                    asset: data?.asset ?? channelPoint?.asset,
                    macro: data?.macro ?? channelPoint?.macro,
                    cost: data?.cost ?? channelPoint?.cost,
                    enable_default: data?.enable_default ?? channelPoint?.enable_default,
                    auto_accept: data?.auto_accept ?? channelPoint?.auto_accept,
                    strip_emotes: data?.strip_emotes ?? channelPoint?.strip_emotes,
                    input_required: data?.input_required ?? channelPoint?.input_required,
                },
            );

            await updateChannelPoints();

            return {
                status: "okay",
                ...result,
            };
        } catch (error: any) {
            return { error: error?.message ?? "edit failed" };
        }
    }
}
