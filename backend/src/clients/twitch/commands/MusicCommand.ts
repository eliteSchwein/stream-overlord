import BaseCommand from './BaseCommand'
import { hasModerator } from '../helper/PermissionHelper'
import { getConfig } from '../../../helper/ConfigHelper'
import {
    back,
    getSongCmd,
    getStatus,
    next,
    pause,
    play,
    setVolume,
    show,
    sync,
} from '../../../helper/MusicHelper'

export default class MusicCommand extends BaseCommand {
    command = 'music'
    enforceSame = true

    params = [
        {
            name: 'control',
            type: 'subcommand',
            required: false,
            subcommands: [
                { name: 'next' },
                { name: 'prev' },
                { name: 'volume' },
                { name: 'play' },
                { name: 'pause' },
            ],
        },
        {
            name: 'volume',
            type: 'number',
            required: false,
        },
    ]

    preRegister() {
        const config = getConfig(/^music$/g)[0]

        if (config) return

        this.registerCommand = false
    }

    async handle(params: any, context: any, rawParams: string[]) {
        if (!params.control) {
            await sync()
            void show()

            await context.reply(getSongCmd())
            return
        }

        if (
            !hasModerator(context.broadcasterName, context.userId) &&
            context.broadcasterId !== context.userId
        ) {
            await this.replyPermissionError(context)
            return
        }

        switch (params.control) {
            case 'play':
                await play()
                await context.reply('Der Song wird nun fortgesetzt.')
                break

            case 'pause':
                await pause()
                await context.reply('Der Song wird nun pausiert.')
                break

            case 'next':
                await next()
                await context.reply('Der nächste Song wird nun gespielt.')
                break

            case 'prev':
                await back()
                await context.reply('Der letzte Song wird nun gespielt.')
                break

            case 'volume':
                if (params.volume === undefined || params.volume === null) {
                    await this.replyMissingParamError(rawParams, context, 1)
                    return
                }

                if (params.volume < 0 || params.volume > 100) {
                    await context.reply('Der Wert muss zwischen 0 und 100 liegen.')
                    return
                }

                await setVolume(params.volume)
                await context.reply(`Die Lautstärke der Musik wurde auf ${params.volume}% gesetzt.`)
                break
        }
    }
}