import {getConfig} from "./ConfigHelper";
import getWebsocketServer from "../App";
import {execute} from "./CommandHelper";
import {logRegular} from "./LogHelper";

let audioData = {};

export async function initAudio() {
    const config = getConfig(/audio /g, true)

    audioData = {}

    for(const key in config) {
        audioData[key] = config[key];

        await setVolume(key, audioData[key].default_volume, false);
    }

    sendAudioUpdate()
}

export async function setVolume(audioInterface: string, volume: number, sendUpdate = true) {
    const currentAudioData = audioData[audioInterface]

    await execute(`${currentAudioData.command} ${volume}`)

    if(volume === 0) {
        logRegular(`mute ${audioInterface}`)
        currentAudioData['muted'] = true;

        if(!currentAudioData['current_volume']) {
            currentAudioData['current_volume'] = currentAudioData['min_range'];
        }
    } else {
        logRegular(`set volume for ${audioInterface} to ${volume}`)
        currentAudioData['current_volume'] = volume;
        currentAudioData['muted'] = false;
    }

    audioData[audioInterface] = currentAudioData

    if (!sendUpdate) return

    sendAudioUpdate()
}

export function sendAudioUpdate() {
    getWebsocketServer().send('notify_audio_update', audioData)
}

export function getAudioData() {
    return audioData
}