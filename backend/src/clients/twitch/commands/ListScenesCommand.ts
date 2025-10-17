import BaseCommand from "./BaseCommand";
import {getOBSClient} from "../../../App";

export default class ListScenesCommand extends BaseCommand {
    command = 'listscenes'
    requiresMod = true
    enforceSame = true
    aliases = ['scenes', 'szenen']

    async handle(params: any, context: any) {
        const sceneItems = getOBSClient().getSceneData()

        if(sceneItems.length === 0) {
            await this.replyCommandError(context, "Es wurde keine OBS Verbindung gefunden.")
            return
        }
        await context.reply('Liste der Szenen:')

        let sceneList = ''
        let counter = 0

        for(const scene of sceneItems) {
            if(counter > 5) {
                await context.reply(sceneList.trim().substring(3))
                sceneList = ""
                counter = 0
            }
            sceneList = `${sceneList} || ${scene.name}`

            counter++
        }
        if(sceneList !== "") {
            await context.reply(sceneList.trim().substring(3))
        }
    }
}