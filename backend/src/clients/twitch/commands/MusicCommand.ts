import BaseCommand from "./BaseCommand";
import getWebsocketServer, {getTauonmbClient} from "../../../App";
import {hasModerator} from "../helper/PermissionHelper";
import {generateBaseUrl} from "../../website/WebsiteClient";
import {getConfig} from "../../../helper/ConfigHelper";

export default class MusicCommand extends BaseCommand {
    command = 'music'
    enforceSame = true
    //globalCooldown = 25
    //userCooldown = 40
    params = [
        {
            name: 'control',
            type: 'subcommand',
            required: false,
            subcommands: [
                {
                    name: 'next'
                },
                {
                    name: 'prev'
                },
                {
                    name: 'volume'
                },
                {
                    name: 'play'
                },
                {
                    name: 'pause'
                }
            ]
        },
        {
            name: 'volume',
            type: 'number',
            required: false,
        }
    ]

    preRegister() {
        const config = getConfig(/api tauonmb/g)[0]

        if (config) return

        this.registerCommand = false
    }

    async handle(params: any, context: any, rawParams: string[]) {
        if(!params.control) {
            getWebsocketServer().send('notify_tauonmb_show', {})
            await context.reply(getTauonmbClient().getSongCmd())
            return
        }

        if(
            !hasModerator(context.broadcasterName, context.userId) &&
            context.broadcasterId !== context.userId) {
            await this.replyPermissionError(context)
            return
        }

        switch (params.control) {
            case 'play':
                await getTauonmbClient().play()
                await context.reply("Der Song wird nun fortgesetzt.")
                break
            case 'pause':
                await getTauonmbClient().pause()
                await context.reply("Der Song wird nun pausiert.")
                break
            case 'next':
                await getTauonmbClient().next()
                await context.reply("Der nächste Song wird nun gespielt.")
                break
            case 'prev':
                await getTauonmbClient().next()
                await context.reply("Der letzte Song wird nun gespielt.")
                break
            case 'volume':
                if(!params.volume) {
                    await this.replyMissingParamError(rawParams, context, 1)
                    return
                }
                if(params.volume < 0 || params.volume > 100) {
                    await context.reply("Der Wert muss zwischen 0 und 100 liegen.")
                    return
                }
                await getTauonmbClient().setVolume(params.volume)
                await context.reply(`Die Lautstärke der Musik wurde auf ${params.volume}% gesetzt.`)
                break
        }
    }
}