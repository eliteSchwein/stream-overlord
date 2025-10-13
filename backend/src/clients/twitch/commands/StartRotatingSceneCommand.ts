import BaseCommand from "./BaseCommand";
import {getTargetRotateScene, startRotateScene, stopRotateScene} from "../../../helper/RotateSceneHelper";

export default class StartRotatingSceneCommand extends BaseCommand {
    command = 'autoscene'
    requiresMod = true
    enforceSame = true
    aliases = ['rotatescene', 'autoszene']
    params = [
        {
            name: 'sceneName',
            type: 'all'
        }
    ]

    async handle(params: any, context: any) {
        if(params.sceneName === 'stop') {
            if(!getTargetRotateScene()) {
                await context.reply('Es wurde keine Auto Szene gestartet.')
                return
            }
            await context.reply('Die Auto Szene wird nun gestoppt.')
            stopRotateScene()
            return
        }
        if(!await startRotateScene(params.sceneName)) {
            await this.replyCommandError(context, `Die Auto Szene ${params.sceneName} wurde nicht gefunden!`)
            return
        }

        await context.reply(`Die Auto Szene ${params.sceneName} wird nun gestartet.`)
    }
}