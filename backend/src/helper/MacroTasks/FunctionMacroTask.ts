import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {getPrimaryChannel} from "../ConfigHelper";
import {sleep} from "../../../../helper/GeneralHelper";
import fillTemplate from "../TemplateHelper";
import {toggleAutoMacro} from "../AutoMacroHelper";
import {speak} from "../TTShelper";
import {addSongRequest, toggleSongRequest} from "../MusicHelper";
import {getTwitchClient} from "../../App";
import {logRegular, logWarn} from "../LogHelper";

export default class FunctionMacroTask extends BaseMacroTask {
    channel = "function"

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
                await sleep(data.time);
                break;
            }

            case "speak": {
                await speak(data.content, data.event_uuid);
                break;
            }

            case "song_request": {
                if (!data.url) {
                    logWarn(`song_request requires url`);
                    break;
                }

                const added = await addSongRequest(fillTemplate(data.url, data));

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
                const primaryChannel = getPrimaryChannel();
                data.content = fillTemplate(data.content, {});

                await getTwitchClient()
                    ?.getBot()
                    ?.api?.chat?.sendChatMessage(primaryChannel, data.content);

                break;
            }

            case "send_dm": {
                if (!data.user || !data.content) {
                    logWarn(`send_dm requires user and content`);
                    break;
                }

                const bot = getTwitchClient().getBot();
                data.content = fillTemplate(data.content, {});

                await bot?.whisper(data.user, data.content);
                break;
            }
        }
    }
}
