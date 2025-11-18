import BaseApi from "../../abstracts/BaseApi";
import {getActiveSound, setActiveSound} from "../../helper/AlertHelper";
import {getConfig} from "../../helper/ConfigHelper";
import {getAudioData} from "../../helper/AudioHelper";
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

        let volume = 1

        if(audioData) {
            volume = audioData.current_volume
            if(audioData.muted) return
        }

        if(data.volume) volume = data.volume

        try {
            await execute(`bash -c "cd ${assetDirectory} && ${config.play_command} -af "volume=${volume}" ${data['sound']}"`)
        } catch (error) {
            logWarn(`playing sound ${data['sound']} failed:`)
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
        }
    }
}