import BaseApi from "../../abstracts/BaseApi";
import {getActiveSound, setActiveSound} from "../../helper/AlertHelper";
import {getConfig} from "../../helper/ConfigHelper";
import {getAudioData, getStreambotSinkName} from "../../helper/AudioHelper";
import {execute} from "../../helper/CommandHelper";
import {logWarn} from "../../helper/LogHelper";
import {assetRoot, compressedAssetRoot} from "../../helper/AssetManagementHelper";
import * as path from "node:path";

export default class PlaySoundApi extends BaseApi {
    restEndpoint = "overlay/play_sound";
    restPost = true;
    websocketMethod = "play_sound";

    async handle(data: any): Promise<any> {
        if (!data.sound) return { error: "missing sound" };

        const sound = String(data.sound);

        if (sound === getActiveSound()) {
            return { error: "sound is already playing" };
        }

        setActiveSound(sound);

        const config = getConfig(/shell/g)[0];

        setTimeout(() => {
            //setActiveSound(null);
        }, 1_250);

        const audioData = getAudioData()["alert"];

        if (audioData?.muted) return;

        const pipewireSinkEnabled =
            audioData?.pipewire_sink === true ||
            audioData?.pipewire_sink === "true";

        const sinkName = getStreambotSinkName("alert");

        let volume = pipewireSinkEnabled
            ? 1
            : Number(audioData?.current_volume ?? 1);

        if (data.volume !== undefined && data.volume !== null) {
            volume = Number(data.volume);
        }

        if (!Number.isFinite(volume)) {
            volume = 1;
        }

        let playCommand = String(config.play_command ?? "");

        if (!playCommand) {
            return { error: "missing play_command" };
        }

        playCommand = playCommand
            .replace(/\$\{volume}/g, String(volume))
            .replace(/\$\{sink}/g, sinkName)
            .replace(/\$\{audio_sink}/g, sinkName)
            .replace(/\$\{audio_device}/g, sinkName);

        if (pipewireSinkEnabled) {
            playCommand =
                `PULSE_SINK=${shellEscape(sinkName)} ` +
                `PIPEWIRE_NODE=${shellEscape(sinkName)} ` +
                playCommand;
        }

        const soundFile = resolveSoundPath(sound);

        void execute(`${playCommand} -af volume=${volume} ${soundFile}`)
            .catch((error) => {
                logWarn(`playing sound ${soundFile} failed:`);
                logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
            })
            .finally(() => {
                setActiveSound(null);
            });
    }
}

function resolveSoundPath(sound: string): string {
    let normalized = String(sound || "")
        .replace(/\\/g, "/")
        .replace(/^\/+/, "");

    if (normalized.startsWith("compressed/")) {
        normalized = normalized.replace(/^compressed\//, "");
        return safeResolve(compressedAssetRoot, normalized);
    }

    if (normalized.startsWith("compressed_assets/")) {
        normalized = normalized.replace(/^compressed_assets\//, "");
        return safeResolve(compressedAssetRoot, normalized);
    }

    if (normalized.startsWith("assets/")) {
        normalized = normalized.replace(/^assets\//, "");
        return safeResolve(assetRoot, normalized);
    }

    return safeResolve(assetRoot, normalized);
}

function safeResolve(root: string, inputPath: string): string {
    const resolved = path.resolve(root, inputPath);

    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
        throw new Error("sound path must stay inside asset directory");
    }

    return resolved;
}

function shellEscape(value: string): string {
    return `'${String(value).replace(/'/g, `'\\''`)}'`;
}