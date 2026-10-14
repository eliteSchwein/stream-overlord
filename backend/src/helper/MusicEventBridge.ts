import {triggerConfiguredEvent} from './EventHelper'
import {MusicEventName, MusicEventPayload, onMusicEvent} from './MusicEventHelper'

const configuredEventByMusicEvent: Record<MusicEventName, string> = {
    start: 'event_music_start',
    end: 'event_music_end',
    next: 'event_music_next',
    prev: 'event_music_prev',
}

let initialized = false

export function initMusicEventBridge() {
    if (initialized) return
    initialized = true

    const bind = (name: MusicEventName) => {
        onMusicEvent(name, async (payload: MusicEventPayload) => {
            await triggerConfiguredEvent(configuredEventByMusicEvent[name], payload)
        })
    }

    bind('start')
    bind('end')
    bind('next')
    bind('prev')
}
