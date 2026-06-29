import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {getTwitchClient} from "../../App";
import {toggleChannelPoint, toggleChannelPointPause} from "../ChannelPointHelper";
import {logWarn} from "../LogHelper";

export default class ChannelPointMacroTask extends BaseMacroTask {
    channel = "channel_point"

    async handle(method: string, data: any = {}, variables: any = {}) {
        const event = variables?.event;
        const channelPointName =
            data?.name ??
            data?.label ??
            data?.channel_point ??
            data?.channelPoint ??
            variables?.channelPoint?.title ??
            variables?.channelPoint?.name ??
            event?.rewardTitle;

        const channelPoint = {
            name: channelPointName,
            label: channelPointName,
        };

        switch (method) {
            case "cancel": {
                const event = variables?.eventData ?? variables?.event;

                if (!event?.broadcasterId || !event?.rewardId || !event?.id) {
                    logWarn(`channel_point cancel requires broadcasterId, rewardId and redemption id`);
                    return;
                }

                await getTwitchClient()?.getBot()?.api?.channelPoints.updateRedemptionStatusByIds(
                    event.broadcasterId,
                    event.rewardId,
                    [event.id],
                    "FULFILLED",
                );

                break;
            }

            case "accept": {
                const event = variables?.eventData ?? variables?.event;

                if (!event?.broadcasterId || !event?.rewardId || !event?.id) {
                    logWarn(`channel_point accept requires broadcasterId, rewardId and redemption id`);
                    return;
                }

                await getTwitchClient()?.getBot()?.api?.channelPoints.updateRedemptionStatusByIds(
                    event.broadcasterId,
                    event.rewardId,
                    [event.id],
                    "CANCELED",
                );

                break;
            }

            case "pause": {
                if (!channelPointName) {
                    logWarn(`channel_point pause requires name`);
                    return;
                }

                await toggleChannelPointPause(channelPoint, true);
                break;
            }

            case "unpause": {
                if (!channelPointName) {
                    logWarn(`channel_point unpause requires name`);
                    return;
                }

                await toggleChannelPointPause(channelPoint, false);
                break;
            }

            case "toggle_pause": {
                if (!channelPointName) {
                    logWarn(`channel_point toggle_pause requires name`);
                    return;
                }

                const pause = data?.pause ?? data?.paused ?? data?.state;

                if (pause === undefined) {
                    await toggleChannelPointPause(channelPoint, true);
                } else {
                    await toggleChannelPointPause(channelPoint, pause === true || pause === "true" || pause === "pause" || pause === "paused");
                }

                break;
            }

            case "enable": {
                if (!channelPointName) {
                    logWarn(`channel_point enable requires name`);
                    return;
                }

                await toggleChannelPoint(channelPoint, true);
                break;
            }

            case "disable": {
                if (!channelPointName) {
                    logWarn(`channel_point disable requires name`);
                    return;
                }

                await toggleChannelPoint(channelPoint, false);
                break;
            }

            case "toggle": {
                if (!channelPointName) {
                    logWarn(`channel_point toggle requires name`);
                    return;
                }

                const enable = data?.enable ?? data?.enabled ?? data?.state;

                if (enable === undefined) {
                    logWarn(`channel_point toggle requires state, enable or enabled`);
                    return;
                }

                await toggleChannelPoint(channelPoint, enable === true || enable === "true" || enable === "enable" || enable === "enabled");
                break;
            }

            default: {
                logWarn(`invalid channel_point method: ${method}`);
                break;
            }
        }
    }
}
