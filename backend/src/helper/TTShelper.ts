import {getConfig} from "./ConfigHelper";
import {execute} from "./CommandHelper";

const escapeRegex = /[\/'"]/

export async function speak(message: string)
{
    const config = getConfig(/tts/g)[0]

    message = message.replace(escapeRegex, '')

    await execute(`bash -c "cd ${config.location} && echo '${message}' | ./piper --model ${config.model} --output_file ${config.output_file}" && ${config.play_command}"`)
}