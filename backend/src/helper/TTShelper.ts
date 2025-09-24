import {getConfig} from "./ConfigHelper";
import {execute} from "./CommandHelper";
import {logDebug, logWarn} from "./LogHelper";
import {getAudioData} from "./AudioHelper";

const escapeRegex = /[\/'"]/

export async function speak(message: string)
{
    const config = getConfig(/tts/g)[0]
    const audioData = getAudioData()['tts']

    if(audioData.muted) {
        logWarn(`TTS failed: muted`)
        return
    }

    message = message.replace(escapeRegex, '')

    try {
        let playCommand = config.play_command

        playCommand = playCommand.replace("${volume}", audioData['current_volume'])

        const command = `bash -c "cd ${config.location} && echo '${message}' | ./piper --model ${config.model} --output-raw | ${playCommand}"`

        logDebug(`TTS Command: ${command}`)
        await execute(command)
    } catch (error) {
        logWarn(`TTS failed:`)
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
    }
}

export function calculateTTSduration(text: string, speechRate = 150) {
    const wordCount = text.trim().split(/\s+/).length
    const duration = (wordCount / speechRate) * 60
    return Number.parseInt(duration.toFixed(0)) + 10
}