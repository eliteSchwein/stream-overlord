import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {sleep} from "../../../../helper/GeneralHelper";
import fillTemplate from "../TemplateHelper";
import {toggleAutoMacro} from "../AutoMacroHelper";
import {speak} from "../TTShelper";
import {addSongRequest, toggleSongRequest} from "../MusicHelper";
import {getTwitchClient} from "../../App";
import {logRegular, logWarn} from "../LogHelper";

export default class FunctionMacroTask extends BaseMacroTask {
    channel = "function";

    async handle(method: string, data: any = {}, variables: any = {}) {
        logRegular(`trigger function: ${method}`);

        switch (method) {
            case "random": {
                const min = Number(data.min);
                const max = Number(data.max);

                if (!Number.isFinite(min) || !Number.isFinite(max)) {
                    logWarn(`random requires min and max`);
                    break;
                }

                if (!data.key) {
                    logWarn(`random requires key`);
                    break;
                }

                const value = Math.floor(Math.random() * (max - min + 1)) + min;
                variables[data.key] = value;

                logRegular(`random ${data.key}=${value} (${min}-${max})`);
                break;
            }

            case "toggle_auto_macro": {
                if (data.name && data.enabled !== undefined) {
                    toggleAutoMacro(data.name, data.enabled);
                }
                break;
            }

            case "sleep": {
                await sleep(Number(data.time ?? 0));
                break;
            }

            case "speak": {
                await speak(
                    fillTemplate(data.content ?? "", variables),
                    data.event_uuid ?? variables.eventUuid
                );
                break;
            }

            case "song_request": {
                if (!data.url) {
                    logWarn(`song_request requires url`);
                    break;
                }

                const added = await addSongRequest(fillTemplate(data.url, variables));

                if (!added) {
                    logWarn(`song_request failed`);
                }

                break;
            }

            case "song_request_toggle": {
                await toggleSongRequest();
                break;
            }

            case "send_message": {
                if (!data.content) {
                    logWarn(`send_message requires content`);
                    break;
                }

                const twitchClient = getTwitchClient();

                if (!twitchClient) {
                    logWarn(`send_message skipped: twitch client is not available`);
                    break;
                }

                await twitchClient.sendMessage(
                    fillTemplate(data.content, variables),
                    data.channel_id ?? data.channelId
                );

                break;
            }

            case "send_dm": {
                if (!data.user) {
                    logWarn(`send_dm requires user`);
                    break;
                }

                if (!data.content) {
                    logWarn(`send_dm requires content`);
                    break;
                }

                const twitchClient = getTwitchClient();

                if (!twitchClient) {
                    logWarn(`send_dm skipped: twitch client is not available`);
                    break;
                }

                await twitchClient.sendDm(
                    fillTemplate(String(data.user), variables),
                    fillTemplate(data.content, variables)
                );

                break;
            }

            case "reply": {
                if (!data.content) {
                    logWarn(`reply requires content`);
                    break;
                }

                const messageId =
                    data.message_id ??
                    data.messageId ??
                    variables.messageId ??
                    variables.event?.messageId ??
                    variables.event?.message?.id;

                if (!messageId) {
                    logWarn(`reply requires message_id`);
                    break;
                }

                const twitchClient = getTwitchClient();

                if (!twitchClient) {
                    logWarn(`reply skipped: twitch client is not available`);
                    break;
                }

                await twitchClient.reply(
                    fillTemplate(data.content, variables),
                    messageId,
                    data.channel_id ?? data.channelId ?? variables.event?.broadcasterId
                );

                break;
            }

            case "announce": {
                if (!data.content) {
                    logWarn(`announce requires content`);
                    break;
                }

                const twitchClient = getTwitchClient();

                if (!twitchClient) {
                    logWarn(`announce skipped: twitch client is not available`);
                    break;
                }

                await twitchClient.announce(
                    fillTemplate(data.content, variables),
                    data.color ?? "primary"
                );

                break;
            }
        }
    }
}