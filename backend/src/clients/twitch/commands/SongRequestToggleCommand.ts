import BaseCommand from './BaseCommand'
import {toggleSongRequest} from "../../../helper/MusicHelper";

export class SongRequestToggleCommand extends BaseCommand {
    command = 'srtoggle'
    requiresMod = true
    enforceSame = true

    async handle(params: any, context: any) {
        const enabled = toggleSongRequest()

        await context.reply(
            enabled
                ? 'Songrequests sind jetzt aktiviert.'
                : 'Songrequests sind jetzt deaktiviert.',
        )
    }
}