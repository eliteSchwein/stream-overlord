import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {getAudioData, setVolume} from "../AudioHelper";
import {logRegular, logWarn} from "../LogHelper";

export default class AudioMacroTask extends BaseMacroTask {
    channel = "audio";

    async handle(method: string, data: any = {}) {
        const audioInterface = String(
            data.interface ??
            data.audio_interface ??
            data.audioInterface ??
            "",
        ).trim();

        if (!audioInterface) {
            logWarn(`audio ${method} requires interface`);
            return;
        }

        const audioData = getAudioData();
        const currentAudio = audioData?.[audioInterface];

        if (!currentAudio) {
            logWarn(`unknown audio interface: ${audioInterface}`);
            return;
        }

        switch (method) {
            case "set_volume": {
                const percent = Number(data.volume ?? data.value);

                if (!Number.isFinite(percent)) {
                    logWarn("audio set_volume requires numeric volume");
                    return;
                }

                const normalizedVolume = Math.max(0, Math.min(100, percent)) / 100;

                await setVolume(audioInterface, normalizedVolume);
                logRegular(`audio ${audioInterface} volume set to ${Math.round(normalizedVolume * 100)}%`);
                return;
            }

            case "adjust_volume":
            case "relative_volume": {
                const deltaPercent = Number(
                    data.volume ??
                    data.value ??
                    data.delta,
                );

                if (!Number.isFinite(deltaPercent)) {
                    logWarn("audio adjust_volume requires numeric adjustment");
                    return;
                }

                const currentVolume = Number(
                    currentAudio.current_volume ??
                    currentAudio.default_volume ??
                    0,
                );

                const nextVolume = Math.max(
                    0,
                    Math.min(1, currentVolume + deltaPercent / 100),
                );

                await setVolume(audioInterface, nextVolume);
                logRegular(
                    `audio ${audioInterface} volume adjusted by ${deltaPercent}% to ${Math.round(nextVolume * 100)}%`,
                );
                return;
            }

            default:
                logWarn(`invalid audio method: ${method}`);
        }
    }
}
