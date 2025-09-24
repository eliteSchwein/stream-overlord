import BaseMessage from "./BaseMessage";
import {execute} from "../../../../helper/CommandHelper";
import {getConfig} from "../../../../helper/ConfigHelper";
import {logWarn} from "../../../../helper/LogHelper";
import {getActiveSound, setActiveSound} from "../../../../helper/AlertHelper";
import {getAudioData} from "../../../../helper/AudioHelper";

export default class PlaySoundMessage extends BaseMessage {
    method = 'play_sound'

    async handle(data: any) {
        if(!data['sound']) return
        if(data['sound'] === getActiveSound()) return

        setActiveSound(data['sound'])

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