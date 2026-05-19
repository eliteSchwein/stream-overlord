import { existsSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { getConfig } from "./ConfigHelper";
import getWebsocketServer from "../App";
import { execute } from "./CommandHelper";
import { logRegular, logWarn } from "./LogHelper";
import { updateMusicVolumeFromAudio } from "./MusicHelper";

const audioVolumeSavePath = path.join(os.homedir(), "streambot-audio.json");

let audioData = {};

export async function initAudio() {
    const config = getConfig(/audio /g, true);
    const savedVolumes = loadSavedAudioVolumes();

    audioData = {};

    for (const key in config) {
        audioData[key] = config[key];

        const savedVolume = Number(savedVolumes[key]?.current_volume);
        const volume = Number.isFinite(savedVolume)
            ? savedVolume
            : audioData[key].default_volume;

        await setVolume(key, volume, false, false);
    }

    await sendAudioUpdate()
}

export async function setVolume(
    audioInterface: string,
    volume: number,
    sendUpdate = true,
    saveUpdate = true,
) {
    const currentAudioData = audioData[audioInterface];

    if (!currentAudioData) return;

    if (currentAudioData.command) {
        try {
            await execute(`${currentAudioData.command} ${volume}`);
        } catch (error) {
            logWarn(`setting volume for ${audioInterface} failed:`);
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        }
    }

    if (volume === 0) {
        logRegular(`mute ${audioInterface}`);
        currentAudioData.muted = true;

        if (!currentAudioData.current_volume) {
            currentAudioData.current_volume = currentAudioData.min_range;
        }
    } else {
        logRegular(`set volume for ${audioInterface} to ${volume}`);
        currentAudioData.current_volume = volume;
        currentAudioData.muted = false;
    }

    audioData[audioInterface] = currentAudioData;

    if (saveUpdate) {
        saveAudioVolumes();
    }

    if (!sendUpdate) return;

    await sendAudioUpdate();
}

function loadSavedAudioVolumes() {
    if (!existsSync(audioVolumeSavePath)) return {};

    try {
        return JSON.parse(readFileSync(audioVolumeSavePath, "utf8"));
    } catch (error) {
        logWarn("loading saved audio volumes failed:");
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        return {};
    }
}

function saveAudioVolumes() {
    const data = {};

    for (const key in audioData) {
        data[key] = {
            current_volume: audioData[key].current_volume,
            muted: audioData[key].muted === true,
        };
    }

    try {
        writeFileSync(audioVolumeSavePath, JSON.stringify(data, null, 4));
    } catch (error) {
        logWarn("saving audio volumes failed:");
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
}

export async function sendAudioUpdate() {
    await updateMusicVolumeFromAudio(audioData);

    getWebsocketServer().send("notify_audio_update", audioData);
}

export function getAudioData() {
    return audioData;
}