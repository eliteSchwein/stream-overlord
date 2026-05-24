import BaseApi from "../../abstracts/BaseApi";
import {getActiveSound, setActiveSound} from "../../helper/AlertHelper";
import {getConfig} from "../../helper/ConfigHelper";
import {getAudioData, getStreambotSinkName} from "../../helper/AudioHelper";
import {execute} from "../../helper/CommandHelper";
import {logWarn} from "../../helper/LogHelper";

export default class PlaySoundApi extends BaseApi {
    restEndpoint = 'overlay/play_sound'
    restPost = true
    websocketMethod = 'play_sound'

    async handle(data: any): Promise<any>
    {
        if(!data.sound) return {"error": "missing sound"}

        const sound = data.sound

        if(data.sound === getActiveSound()) return {"error": "sound is already playing"}

        setActiveSound(sound)

        const assetDirectory = `${__dirname}/../../assets`
        const config = getConfig(/shell/g)[0]

        setTimeout(() => {
            setActiveSound(null)
        }, 250)

        const audioData = getAudioData()['alert']

        if(audioData?.muted) return

        const pipewireSinkEnabled = audioData?.pipewire_sink === true || audioData?.pipewire_sink === "true"
        const sinkName = getStreambotSinkName("alert")

        let volume = pipewireSinkEnabled ? 1 : Number(audioData?.current_volume ?? 1)

        if(data.volume !== undefined && data.volume !== null) {
            volume = Number(data.volume)
        }

        if(!Number.isFinite(volume)) {
            volume = 1
        }

        let playCommand = String(config.play_command ?? "")

        if(!playCommand) {
            return {"error": "missing play_command"}
        }

        playCommand = playCommand
            .replace(/\$\{volume}/g, String(volume))
            .replace(/\$\{sink}/g, sinkName)
            .replace(/\$\{audio_sink}/g, sinkName)
            .replace(/\$\{audio_device}/g, sinkName)

        if(pipewireSinkEnabled) {
            playCommand = `PULSE_SINK=${shellEscape(sinkName)} PIPEWIRE_NODE=${shellEscape(sinkName)} ${playCommand}`
        }

        try {
            await execute(`bash -c "cd ${shellEscape(assetDirectory)} && ${playCommand} -af ${shellEscape(`volume=${volume}`)} ${shellEscape(data['sound'])}"`)
        } catch (error) {
            logWarn(`playing sound ${data['sound']} failed:`)
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
        }
    }
}

function shellEscape(value: string): string {
    return `'${String(value).replace(/'/g, `'\\''`)}'`
}
