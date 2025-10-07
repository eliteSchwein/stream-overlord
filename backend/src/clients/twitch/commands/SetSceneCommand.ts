import BaseCommand from "./BaseCommand";
import {getOBSClient} from "../../../App";

export default class SetSceneCommand extends BaseCommand {
    command = 'setscene'
    requiresMod = true
    enforceSame = true
    aliases = ['scene']
    params = [
        {
            name: 'sceneName',
            type: 'all'
        },
    ]

    async handle(params: any, context: any) {
        const obsClient = getOBSClient()
        const sceneItems = obsClient.getSceneData()

        if(sceneItems.length === 0) {
            await this.replyCommandError(context, "Es wurde keine OBS Verbindung gefunden.")
            return
        }

        for(const scene of sceneItems) {
            if(scene.name === params.sceneName) {
                await context.reply(`Szene ${params.sceneName} wird nun gesetzt.`)

                await obsClient.send('SetCurrentProgramScene', {sceneUuid: scene.uuid})
                return
            }
        }

        await this.replyCommandError(context, "Die angegebene Szene wurde nicht gefunden.")
    }
}