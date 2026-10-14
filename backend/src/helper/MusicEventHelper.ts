import {EventEmitter} from 'node:events'

export type MusicEventName = 'start' | 'end' | 'next' | 'prev'

export type MusicEventPayload = {
    music: any
    direction?: 'next' | 'prev'
    previous_index?: number
    current_index?: number
}

const musicEvents = new EventEmitter()

export function emitMusicEvent(name: MusicEventName, payload: MusicEventPayload) {
    musicEvents.emit(name, payload)
}

export function onMusicEvent(name: MusicEventName, listener: (payload: MusicEventPayload) => void | Promise<void>) {
    const wrapped = (payload: MusicEventPayload) => {
        void Promise.resolve(listener(payload))
    }

    musicEvents.on(name, wrapped)

    return () => musicEvents.off(name, wrapped)
}
