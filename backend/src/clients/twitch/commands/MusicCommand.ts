import BaseCommand from './BaseCommand'
import {hasModerator} from '../helper/PermissionHelper'
import {back, getSongCmd, next, pause, play, setVolume, show, sync,} from '../../../helper/MusicHelper'
import {translate} from '../../../helper/LocaleHelper'

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
                await context.reply(translate('music.play'))
                break

            case 'pause':
                await pause()
                await context.reply(translate('music.pause'))
                break

            case 'next':
                await next()
                await context.reply(translate('music.next'))
                break

            case 'prev':
                await back()
                await context.reply(translate('music.prev'))
                break

            case 'volume':
                if (params.volume === undefined || params.volume === null) {
                    await this.replyMissingParamError(rawParams, context, 1)
                    return
                }

                if (params.volume < 0 || params.volume > 100) {
                    await context.reply(translate('music.volume_range'))
                    return
                }

                await setVolume(params.volume)
                await context.reply(translate('music.volume_set', {volume: params.volume}))
                break
        }
    }
}