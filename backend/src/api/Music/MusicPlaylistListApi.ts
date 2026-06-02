import BaseApi from '../../abstracts/BaseApi'
import {getRegularMusicFiles, getStatus} from '../../helper/MusicHelper'
import path from 'path'

type PlaylistEntry = {
    filename?: string
    path?: string
    title?: string
    current?: boolean
    [key: string]: any
}

const DEFAULT_BEFORE = 5
const DEFAULT_AFTER = 5
const DEFAULT_WINDOW_SIZE = DEFAULT_BEFORE + 1 + DEFAULT_AFTER

function parseIndex(value: any, fallback = 0): number {
    const parsed = Number(value)

    if (!Number.isFinite(parsed)) return fallback

    return Math.max(0, Math.floor(parsed))
}

function getEntryPath(entry: PlaylistEntry): string {
    return entry.path ?? entry.filename ?? ''
}

function normalizeSearch(value: any): string {
    return String(value ?? '')
        .trim()
        .toLowerCase()
}

function getSearchValue(entry: PlaylistEntry): string {
    return [
        entry.title,
        entry.filename,
        entry.path,
        path.basename(getEntryPath(entry)),
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
}

function filterPlaylistFiles(files: PlaylistEntry[], search: string): PlaylistEntry[] {
    if (search.length < 2) return files

    return files.filter(file => getSearchValue(file).includes(search))
}

function getActivePlaylistIndex(files: PlaylistEntry[], currentPath: string | null | undefined): number {
    const explicitCurrent = files.findIndex(file => file.current === true)

    if (explicitCurrent !== -1) return explicitCurrent
    if (!currentPath) return -1

    return files.findIndex(file => {
        const entryPath = getEntryPath(file)

        if (!entryPath) return false
        if (entryPath === currentPath) return true

        try {
            return path.resolve(entryPath) === path.resolve(currentPath)
        } catch {
            return path.basename(entryPath) === path.basename(currentPath)
        }
    })
}

function normalizePlaylistFiles(): PlaylistEntry[] {
    const musicStatus = getStatus()
    const statusPlaylist = musicStatus?.playlist

    if (Array.isArray(statusPlaylist) && statusPlaylist.length > 0) {
        return statusPlaylist
    }

    return getRegularMusicFiles()
}

export default class MusicPlaylistListApi extends BaseApi {
    restEndpoint = 'music/playlist'
    restPost = false
    websocketMethod = 'music_playlist'

    async handle(data: any) {
        const musicStatus = getStatus()
        const allFiles = normalizePlaylistFiles()
        const showAll = data?.show_all === true || data?.show_all === 'true'
        const search = normalizeSearch(data?.search ?? data?.filter ?? data?.query ?? data?.q)
        const files = filterPlaylistFiles(allFiles, search)
        const activeFullIndex = getActivePlaylistIndex(allFiles, musicStatus?.track?.path ?? musicStatus?.path)
        const currentPath = activeFullIndex === -1 ? musicStatus?.track?.path ?? musicStatus?.path : getEntryPath(allFiles[activeFullIndex])
        const activeIndex = getActivePlaylistIndex(files, currentPath)

        if (showAll) {
            return {
                status: 'okay',
                files,
                playlist_length: files.length,
                active_index: activeIndex,
                active_full_index: activeFullIndex,
                start_index: 0,
                end_index: files.length,
                has_prev: false,
                has_next: false,
                show_all: true,
                search,
            }
        }

        const defaultStartIndex = search.length >= 2 || activeIndex === -1
            ? 0
            : Math.max(0, activeIndex - DEFAULT_BEFORE)

        const startIndex = parseIndex(data?.start_index ?? data?.startIndex, defaultStartIndex)
        const endIndex = Math.min(files.length, startIndex + DEFAULT_WINDOW_SIZE)

        return {
            status: 'okay',
            files: files.slice(startIndex, endIndex),
            playlist_length: files.length,
            active_index: activeIndex,
            active_full_index: activeFullIndex,
            start_index: startIndex,
            end_index: endIndex,
            window_size: DEFAULT_WINDOW_SIZE,
            has_prev: startIndex > 0,
            has_next: endIndex < files.length,
            show_all: false,
            search,
        }
    }
}
