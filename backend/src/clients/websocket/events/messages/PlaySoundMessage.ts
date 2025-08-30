import BaseMessage from "./BaseMessage";
import {execute} from "../../../../helper/CommandHelper";
import {getConfig} from "../../../../helper/ConfigHelper";
import {logWarn} from "../../../../helper/LogHelper";
import {getActiveSound, setActiveSound} from "../../../../helper/AlertHelper";

export default class PlaySoundMessage extends BaseMessage {
    method = 'play_sound'

    async handle(data: any) {
        if(!data['sound']) return
        if(data['sound'] === getActiveSound()) return

        setActiveSound(data['sound'])

        const assetDirectory = `${__dirname}/../../assets`
        const config = getConfig(/shell/g)[0]

        try {
            await execute(`bash -c "cd ${assetDirectory} && ${config.play_command} ${data['sound']}"`)
        } catch (error) {
            logWarn(`playing sound ${data['sound']} failed:`)
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
        }

        setActiveSound(null)
    }
}