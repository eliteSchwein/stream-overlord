import {getConfig} from "./ConfigHelper";
import {execute} from "./CommandHelper";
import {logDebug, logWarn} from "./LogHelper";

const escapeRegex = /[\/'"]/

export async function speak(message: string)
{
    const config = getConfig(/tts/g)[0]

    message = message.replace(escapeRegex, '')

    try {
        let command =  `bash -c "cd ${config.location} && echo '${message}' | ./piper --model ${config.model} --output_file ${config.output_file} && ${config.play_command}"`

        if(config.raw_command) {
            command = `bash -c "cd ${config.location} && echo '${message}' | ./piper --model ${config.model} --output-raw | ${config.play_command}"`
        }

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