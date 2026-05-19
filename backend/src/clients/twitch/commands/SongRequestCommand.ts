import BaseCommand from './BaseCommand'
import {
    addSongRequest,
    isSongRequestEnabled,
} from '../../../helper/MusicHelper'

export default class SongRequestCommand extends BaseCommand {
    command = 'sr'
    requiresMod = false
    enforceSame = true

    params = [
        {
            name: 'url',
            type: 'string',
        },
    ]

    async handle(params: any, context: any) {
        if (!isSongRequestEnabled()) {
            await this.replyCommandError(context, 'Songrequests sind aktuell deaktiviert.')
            return
        }

        const url = params.url

        if (!url) {
            await this.replyCommandError(context, 'Bitte eine YouTube oder Deezer URL angeben.')
            return
        }

        const added = await addSongRequest(url)

        if (!added) {
            await this.replyCommandError(context, 'Songrequest konnte nicht hinzugefügt werden.')
            return
        }

        await context.reply('Songrequest wurde hinzugefügt.')
    }
}