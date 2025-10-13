import BaseCommand from "./BaseCommand";
import {getConfig} from "../../../helper/ConfigHelper";

export default class ListRotatingScenes extends BaseCommand {
    command = 'listautoscenes'
    requiresMod = true
    enforceSame = true
    aliases = ['listautoszenen']

    async handle(params: any, context: any) {
        const config = getConfig((/^rotating_scene /g), true)

        await context.reply('Liste der Auto Szenen:')

        let sceneList = ''
        let counter = 0

        for(const scene in config) {
            if(counter > 5) {
                await context.reply(sceneList.trim().substring(3))
                sceneList = ""
            }
            sceneList = `${sceneList} || ${scene}`

            counter++
        }
        if(sceneList !== "") {
            await context.reply(sceneList.trim().substring(3))
        }
    }
}