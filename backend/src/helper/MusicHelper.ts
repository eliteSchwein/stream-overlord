import { execFile, spawn, ChildProcessWithoutNullStreams } from 'child_process'
import {
    existsSync,
    mkdirSync,
    readdirSync,
    readFileSync,
    renameSync,
    rmSync,
    statSync,
    unlinkSync,
    writeFileSync,
} from 'fs'
import { Socket } from 'net'
import os from 'os'
import path from 'path'
import getWebsocketServer, {getTwitchClient} from '../App'
import { getConfig } from './ConfigHelper'
import {
    cleanupPipewireAudioSink,
    getAudioData,
    getPipewireSinkOutputVolumePercent,
    getStreambotSinkName,
    setPipewireSinkOutputVolume,
    setupPipewireAudioSink,
} from './AudioHelper'
import {logDebug, logError, logRegular, logSuccess, logWarn} from './LogHelper'
import https from 'https'

const songRequestPath = '/tmp/songrequests'
const mpvSocketPath = '/tmp/streambot-music-mpv.sock'
const cavaConfigPath = '/tmp/streambot-cava.conf'
const musicStatePath = '/tmp/streambot-music-state.json'
const musicThumbnailPath = '/tmp/streambot-music-thumbnail.png'
const streambotMusicConfigName = 'music'
const streambotMusicSink = getStreambotSinkName(streambotMusicConfigName)

let musicPath = '$HOME/Music/Streambot'
let songRequestEnabled = false
let cavaEnabled = false
let mpvProcess: ChildProcessWithoutNullStreams | null = null
let cavaProcess: ChildProcessWithoutNullStreams | null = null
let mpvEventSocket: Socket | null = null
let musicUpdateInterval: ReturnType<typeof setInterval> | null = null
let status: any = null
let songRequestQueue: string[] = []
let songRequestTitleMap: Record<string, string> = {}
let songRequestBlocklist: string[] = []
let currentRequestIndex = 0
let songRequestBusy = false
let pendingMusicCrashState: MusicCrashState | null = null
let suppressMusicStateWrite = true
let overlayDuration = 15_000
let musicOverlayTimeout: ReturnType<typeof setTimeout> | null = null
let lastThumbnailTrackKey: string | null = null
let musicShuffleEnabled = false

type MusicCrashState = {
    path: string | null
    filename: string | null
    title: string
    artist: string
    progress: number
    duration: number
    paused: boolean
    songrequest_enabled: boolean
    songrequest_active: boolean
    current_is_songrequest: boolean
    songrequest_queue: string[]
    songrequest_title_map: Record<string, string>
    songrequest_blocklist: string[]
    songrequest_current_index: number
    songrequest_current_url: string | null
    updated_at: string
}

export function loadMusicConfig() {
    logRegular('init musicplayer')

    const musicConfig = getConfig(/^music$/g)[0] ?? {}

    overlayDuration = Number(musicConfig.overlay_duration ?? 15_000)

    if (!Number.isFinite(overlayDuration)) {
        overlayDuration = 15_000
    }

    musicPath = expandPath(musicConfig.path ?? '$HOME/Music/Streambot')
    songRequestEnabled = musicConfig.songrequest === true || musicConfig.songrequest === 'true'
    cavaEnabled = musicConfig.cava === true || musicConfig.cava === 'true'

    mkdirSync(songRequestPath, { recursive: true })
}

function getInitialMusicVolumePercent(): number {
    const audioData: any = getAudioData()
    const musicAudio = audioData?.music

    if (!musicAudio) return 20
    if (musicAudio.muted) return 0

    const volume = Number(
        musicAudio.current_volume ??
        musicAudio.default_volume ??
        0.2
    )

    if (!Number.isFinite(volume)) return 20

    return Math.round(Math.max(0, Math.min(1, volume)) * 100)
}

export async function startMusicPlayer(restoreModeFromState = true) {
    pendingMusicCrashState = readMusicCrashState()

    suppressMusicStateWrite = true
    await stopMusicPlayer()

    if (restoreModeFromState && pendingMusicCrashState?.songrequest_enabled === true) {
        songRequestEnabled = true
    }

    if (songRequestEnabled) {
        await prepareSongRequestCache()
    }

    const files = songRequestEnabled
        ? getSongRequestFiles().filter(file => isMusicFile(file))
        : getRegularMusicFiles().map(file => file.path)

    if (files.length === 0) {
        logWarn('music player not started: no music files found')
        suppressMusicStateWrite = false
        await sync()
        return
    }

    if (existsSync(mpvSocketPath)) {
        unlinkSync(mpvSocketPath)
    }

    await setupPipewireAudioSink(streambotMusicConfigName)

    const initialVolume = getInitialMusicVolumePercent()

    const mpvArgs = [
        '--loop-playlist=inf',
        '--no-video',
        '--idle=yes',
        '--volume=100',
        '--audio-client-name=streambot_music',
        `--audio-device=pulse/${streambotMusicSink}`,
        `--input-ipc-server=${mpvSocketPath}`,
    ]

    mpvArgs.push(...files)

    mpvProcess = spawn('mpv', mpvArgs)

    await setPipewireSinkOutputVolume(streambotMusicConfigName, initialVolume / 100)

    mpvProcess.stdout.on('data', data => logDebug(`[mpv] ${data.toString().trim()}`))
    mpvProcess.stderr.on('data', data => logDebug(`[mpv] ${data.toString().trim()}`))

    mpvProcess.on('error', error => {
        logError(`[mpv] failed to start: ${error.message}`)
        mpvProcess = null
    })

    mpvProcess.on('exit', (code, signal) => {
        logWarn(`[mpv] exited with code ${code}, signal ${signal}`)
        mpvProcess = null
        stopMpvEventListener()
        stopMusicUpdateInterval()
    })

    await waitForMpvSocket()

    if (!existsSync(mpvSocketPath)) {
        logWarn('music player not ready: mpv socket missing')
        mpvProcess = null
        suppressMusicStateWrite = false
        await sync()
        return
    }

    startMpvEventListener()

    if (musicShuffleEnabled) {
        await mpvCommand(['playlist-shuffle'])
    }

    await applyMusicCrashState()

    suppressMusicStateWrite = false
    startMusicUpdateInterval()

    if (cavaEnabled) {
        startCavaFeed()
    }

    await sync()

    logSuccess('music player is ready')
}

export async function stopMusicPlayer() {
    suppressMusicStateWrite = true
    stopCavaFeed()
    stopMpvEventListener()
    stopMusicUpdateInterval()

    if (!mpvProcess) {
        await cleanupPipewireAudioSink(streambotMusicConfigName)
        return
    }

    const process = mpvProcess
    mpvProcess = null

    await mpvCommand(['quit'])

    await new Promise<void>(resolve => {
        const timeout = setTimeout(() => {
            if (!process.killed) {
                process.kill('SIGKILL')
            }

            resolve()
        }, 1000)

        process.once('exit', () => {
            clearTimeout(timeout)
            resolve()
        })
    })

    if (existsSync(mpvSocketPath)) {
        unlinkSync(mpvSocketPath)
    }

    await cleanupPipewireAudioSink(streambotMusicConfigName)
}

export async function reloadMusicPlayer(restoreModeFromState = false) {
    await startMusicPlayer(restoreModeFromState)
}

export function getActiveMusicPath(): string {
    return songRequestEnabled ? songRequestPath : musicPath
}

export function isSongRequestEnabled(): boolean {
    return songRequestEnabled
}

function parseBooleanValue(value: any, fallback = false): boolean {
    if (value === undefined || value === null || value === '') return fallback
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value !== 0

    const normalized = String(value).trim().toLowerCase()

    if (['true', '1', 'yes', 'on', 'enabled', 'enable'].includes(normalized)) return true
    if (['false', '0', 'no', 'off', 'disabled', 'disable'].includes(normalized)) return false

    return fallback
}

function normalizeSearchInput(value: any): string {
    return String(value ?? '').trim().toLowerCase()
}

function findRegularMusicByInput(input: any): { filename: string, path: string } | null {
    const query = normalizeSearchInput(input)

    if (!query) return null

    const files = getRegularMusicFiles()

    return files.find(file => {
        const filename = normalizeSearchInput(file.filename)
        const filePath = normalizeSearchInput(file.path)

        return filename === query ||
            filePath === query ||
            filename.includes(query) ||
            filePath.includes(query)
    }) ?? null
}

export async function toggleSongRequest(): Promise<boolean> {
    songRequestEnabled = !songRequestEnabled

    if (!songRequestEnabled) {
        clearSongRequestCache()
    }

    await reloadMusicPlayer(false)
    await sync()

    try {
        if(songRequestEnabled) {
            void getTwitchClient().announce("Ihr könnt nun Songs wünschen mit !sr")
        } else {
            void getTwitchClient().announce("Wunschsongs sind nun deaktiviert")
        }
    } catch (error) {

    }

    logRegular(
        songRequestBlocklist
            ? `songrequests enabled`
            : `songrequests disabled`
    );

    return songRequestEnabled
}

function unwrapDeezerLinkUrl(url: string): string {
    const parsed = new URL(url)

    const realUrl =
        parsed.searchParams.get('dest') ??
        parsed.searchParams.get('awf') ??
        parsed.searchParams.get('gwf') ??
        parsed.searchParams.get('iwf')

    return realUrl ?? url
}

function resolveRedirectUrl(url: string): Promise<string> {
    return new Promise(resolve => {
        https.get(url, response => {
            const location = response.headers.location

            if (!location) {
                resolve(url)
                return
            }

            resolve(new URL(location, url).toString())
        }).on('error', () => resolve(url))
    })
}

export async function addSongRequest(url: string): Promise<boolean> {
    if (!songRequestEnabled) {
        logWarn('songrequest failed: songrequests are disabled')
        return false
    }

    let normalizedUrl = normalizeSongRequestUrl(url)

    if (normalizedUrl.includes('link.deezer.com')) {
        const redirectedUrl = await resolveRedirectUrl(normalizedUrl)
        normalizedUrl = normalizeSongRequestUrl(unwrapDeezerLinkUrl(redirectedUrl))
    }

    if (songRequestBlocklist.includes(normalizedUrl)) {
        logWarn(`songrequest failed: blocked url ${normalizedUrl}`)
        return false
    }

    if (songRequestQueue.includes(normalizedUrl)) {
        logWarn(`songrequest failed: already queued ${normalizedUrl}`)
        return false
    }

    songRequestQueue.push(normalizedUrl)

    mkdirSync(songRequestPath, { recursive: true })

    const before = getSongRequestFiles()

    await downloadSongRequest(normalizedUrl)

    const after = getSongRequestFiles()
    const created = after.find(file => !before.includes(file))

    if (created) {
        songRequestTitleMap[path.basename(created)] = normalizedUrl
    }

    if (!mpvProcess || !existsSync(mpvSocketPath)) {
        logRegular('mpv not running, starting music player after songrequest')
        await startMusicPlayer()
    } else {
        const changed = await appendMissingDownloadedSongs()

        if (changed) {
            await sleep(250)
        }
    }

    await sync()

    return true
}

export async function sync() {
    status = await getMusicUpdate()

    writeMusicCrashState(status)

    getWebsocketServer().send('notify_music_update', status)
}

export async function show() {
    getWebsocketServer().send('notify_music_show', getStatus())

    const { triggerMacro } = await import('./MacroHelper')

    if (musicOverlayTimeout) {
        clearTimeout(musicOverlayTimeout)
        musicOverlayTimeout = null
    }

    void triggerMacro('music_start', {
        music: getStatus(),
    })

    musicOverlayTimeout = setTimeout(() => {
        musicOverlayTimeout = null

        void triggerMacro('music_end', {
            music: getStatus(),
        })
    }, overlayDuration)
}

export function getSongCmd() {
    if (!status) return ''

    if (status.artist) {
        return `${status.artist} - ${status.title}`
    }

    return status.title ?? ''
}

export function getStatus() {
    return status
}

export async function next() {
    await mpvCommand(['playlist-next', 'force'])
    await sync()
    void show()
}

export async function play() {
    await mpvCommand(['set_property', 'pause', false])
    await sync()
    void show()
}

export async function pause() {
    await mpvCommand(['set_property', 'pause', true])
    await sync()
    void show()
}

export async function back() {
    await mpvCommand(['playlist-prev', 'force'])
    await sync()
    void show()
}

export async function togglePause() {
    await mpvCommand(['cycle', 'pause'])
    await sync()
}

export async function stopMusicPlayback() {
    await mpvCommand(['stop'])
    await sync()
    void show()
}

export async function setMusicShuffle(enabled: any) {
    musicShuffleEnabled = parseBooleanValue(enabled, false)

    if (musicShuffleEnabled) {
        await mpvCommand(['playlist-shuffle'])
        await sync()
        void show()
        return
    }

    await reloadMusicPlayer(false)
    await sync()
    void show()
}

export async function toggleMusicShuffle() {
    await setMusicShuffle(!musicShuffleEnabled)
}

export async function setMusicLoop(enabled: any) {
    const shouldEnable = parseBooleanValue(enabled, false)

    await mpvCommand(['set_property', 'loop-playlist', shouldEnable ? 'inf' : 'no'])
    await sync()
    void show()
}

export async function toggleMusicLoop() {
    const current = await mpvGetProperty('loop-playlist')
    await setMusicLoop(!(current === 'inf' || current === true))
}

export async function setMusicLoopFile(enabled: any) {
    const shouldEnable = parseBooleanValue(enabled, false)

    await mpvCommand(['set_property', 'loop-file', shouldEnable ? 'inf' : 'no'])
    await sync()
    void show()
}

export async function toggleMusicLoopFile() {
    const current = await mpvGetProperty('loop-file')
    await setMusicLoopFile(!(current === 'inf' || current === true))
}

export async function playSong(options: any = {}) {
    const shouldContinue = parseBooleanValue(options.continue ?? options.continue_playlist ?? options.continuePlaylist, true)
    const shouldRestart = parseBooleanValue(options.restart, true)
    const shouldPause = parseBooleanValue(options.pause, false)
    const wantedPath = options.path ? expandPath(String(options.path)) : null
    const wantedIndex = options.index !== undefined ? Number(options.index) : null
    const query = options.song ?? options.query ?? options.filename ?? options.title ?? options.name
    const files = getRegularMusicFiles()

    let target: { filename: string, path: string } | null = null

    if (wantedPath) {
        target = files.find(file => path.resolve(file.path) === path.resolve(wantedPath)) ?? {
            filename: path.basename(wantedPath),
            path: wantedPath,
        }
    } else if (Number.isFinite(wantedIndex)) {
        const safeIndex = Math.max(0, Math.min(files.length - 1, Number(wantedIndex)))
        target = files[safeIndex] ?? null
    } else {
        target = findRegularMusicByInput(query)
    }

    if (!target || !target.path || !existsSync(target.path)) {
        logWarn(`music_play_song failed: song not found (${query ?? wantedPath ?? wantedIndex ?? 'missing query'})`)
        return false
    }

    if (!mpvProcess || !existsSync(mpvSocketPath)) {
        await startMusicPlayer(false)
    }

    if (shouldContinue) {
        const playlist = await getPlaylist()
        const playlistIndex = playlist.findIndex((item: any) => {
            const itemPath = item.filename ?? item.path ?? ''

            return itemPath === target.path || path.resolve(itemPath) === path.resolve(target.path)
        })

        if (playlistIndex !== -1) {
            await mpvCommand(['set_property', 'playlist-pos', playlistIndex])
        } else {
            await mpvCommand(['loadfile', target.path, 'append-play'])
            const updatedPlaylist = await getPlaylist()
            const appendedIndex = updatedPlaylist.findIndex((item: any) => {
                const itemPath = item.filename ?? item.path ?? ''

                return itemPath === target.path || path.resolve(itemPath) === path.resolve(target.path)
            })

            if (appendedIndex !== -1) {
                await mpvCommand(['set_property', 'playlist-pos', appendedIndex])
            }
        }
    } else {
        await mpvCommand(['set_property', 'loop-playlist', 'no'])
        await mpvCommand(['set_property', 'keep-open', true])
        await mpvCommand(['loadfile', target.path, 'replace'])
    }

    if (shouldRestart) {
        await sleep(100)
        await mpvCommand(['seek', 0, 'absolute'])
    }

    await mpvCommand(['set_property', 'pause', shouldPause])
    await sync()
    void show()

    return true
}

export async function setVolume(volume: number) {
    await mpvSetVolume(volume / 100)
    await sync()
}

export async function setRelativeVolume(volume: number) {
    const currentVolume = await getPipewireSinkOutputVolumePercent(streambotMusicConfigName)
    const nextVolume = Math.max(0, Math.min(100, currentVolume + volume))

    await setPipewireSinkOutputVolume(streambotMusicConfigName, nextVolume / 100)
    await sync()
}

export async function updateMusicVolumeFromAudio(audioData: any) {
    const musicAudio = audioData.music

    if (!musicAudio) return

    const volume = musicAudio.muted
        ? 0
        : Number(musicAudio.current_volume ?? musicAudio.default_volume ?? 0.2)

    await mpvSetVolume(volume)
    await sync()
}

export async function deleteSong(filename: string) {
    if (!filename) throw new Error('filename missing')

    const safeFilename = path.basename(filename)
    const targetFile = path.join(getActiveMusicPath(), safeFilename)

    if (!existsSync(targetFile)) {
        throw new Error('file not found')
    }

    const blockedUrl = songRequestTitleMap[safeFilename]

    if (blockedUrl && !songRequestBlocklist.includes(blockedUrl)) {
        songRequestBlocklist.push(blockedUrl)
    }

    delete songRequestTitleMap[safeFilename]

    const currentPath = await mpvGetProperty('path')
    const isCurrentSong = currentPath === targetFile || path.basename(currentPath ?? '') === safeFilename

    if (isCurrentSong) {
        await mpvCommand(['playlist-next', 'force'])
        await sleep(150)
    }

    await removeFromPlaylist(targetFile)

    if (existsSync(targetFile)) {
        rmSync(targetFile, { force: true })
    }

    await sleep(150)
    await sync()

    return {
        deleted: true,
        filename: safeFilename,
        blocked_url: blockedUrl ?? null,
    }
}

async function getMusicUpdate() {
    const current = await getCurrentMusic()
    let playlist = await getPlaylist()
    const volume = await getPipewireSinkOutputVolumePercent(streambotMusicConfigName)
    const thumbnail = await getMusicThumbnailUpdate(current.path)
    const shuffle = musicShuffleEnabled
    const loopPlaylist = await mpvGetProperty('loop-playlist')
    const loopFile = await mpvGetProperty('loop-file')

    if (!playlist.length && !songRequestEnabled) {
        playlist = getRegularMusicFiles()
    }

    return {
        status: current.pause ? 'paused' : 'playing',
        path: getActiveMusicPath(),
        volume,
        shuffle,
        loop: loopPlaylist === 'inf' || loopPlaylist === true,
        loop_playlist: loopPlaylist,
        loop_file: loopFile === 'inf' || loopFile === true,
        loop_file_mode: loopFile,
        progress: current.progress,
        progress_percentage: current.duration > 0 ? (current.progress / current.duration) * 100 : 0,
        position: current.position,
        duration: current.duration,
        title: current.title,
        artist: current.artist,
        album: current.album,
        thumbnail,
        track: current,
        playlist,
        playlist_length: Array.isArray(playlist) ? playlist.length : 0,
        songrequest: getSongRequestState(),
    }
}

export function getSongRequestState() {
    const files = getSongRequestFiles().filter(file => isMusicFile(file))

    return {
        enabled: songRequestEnabled,
        busy: songRequestBusy,
        path: songRequestPath,
        queue: songRequestQueue,
        queue_length: songRequestQueue.length,
        queue_position: currentRequestIndex,
        current_url: songRequestQueue[currentRequestIndex] ?? null,
        next_url: songRequestQueue[currentRequestIndex + 1] ?? null,
        files,
        title_map: songRequestTitleMap,
        blocklist: songRequestBlocklist,
    }
}

async function getCurrentMusic() {
    const metadata = await mpvGetProperty('metadata') ?? {}
    const duration = secondsToMs(await mpvGetProperty('duration'))
    const position = secondsToMs(await mpvGetProperty('time-pos'))
    const filename = await mpvGetProperty('filename')
    const mediaTitle = await mpvGetProperty('media-title')

    return {
        title: metadata.title ?? metadata.TITLE ?? mediaTitle ?? filename ?? '',
        artist: metadata.artist ?? metadata.ARTIST ?? metadata.album_artist ?? metadata.ALBUMARTIST ?? '',
        album: metadata.album ?? metadata.ALBUM ?? '',
        album_artist: metadata.album_artist ?? metadata.ALBUMARTIST ?? '',
        duration,
        position,
        progress: position,
        path: await mpvGetProperty('path'),
        filename,
        pause: await mpvGetProperty('pause'),
        track_number: metadata.track ?? metadata.TRACK ?? metadata.tracknumber ?? metadata.TRACKNUMBER ?? '',
    }
}

async function getMusicThumbnailUpdate(trackPath: string | null) {

    if (!trackPath || !existsSync(trackPath)) {
        lastThumbnailTrackKey = null

        if (existsSync(musicThumbnailPath)) {
            rmSync(musicThumbnailPath, { force: true })
        }

        return null
    }

    const trackKey = getThumbnailTrackKey(trackPath)

    if (trackKey === lastThumbnailTrackKey) {
        return null
    }

    lastThumbnailTrackKey = trackKey

    if (existsSync(musicThumbnailPath)) {
        rmSync(musicThumbnailPath, { force: true })
    }

    const extracted = await extractMusicThumbnail(trackPath)

    if (!extracted || !existsSync(musicThumbnailPath)) {
        return null
    }

    const base64 = readFileSync(musicThumbnailPath).toString('base64')

    return {
        path: musicThumbnailPath,
        mime: 'image/png',
        base64,
        data_url: `data:image/png;base64,${base64}`,
    }
}

function getThumbnailTrackKey(trackPath: string): string {
    try {
        const stat = statSync(trackPath)

        return `${trackPath}:${stat.size}:${stat.mtimeMs}`
    } catch (error) {
        return trackPath
    }
}

async function extractMusicThumbnail(trackPath: string): Promise<boolean> {
    const args = [
        '-y',
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        trackPath,
        '-map',
        '0:v:0',
        '-frames:v',
        '1',
        musicThumbnailPath,
    ]

    return new Promise(resolve => {
        execFile('ffmpeg', args, (error, stdout, stderr) => {
            if (error) {
                resolve(false)
                return
            }

            const exists = existsSync(musicThumbnailPath)
            const size = exists ? statSync(musicThumbnailPath).size : 0

            resolve(exists && size > 0)
        })
    })
}

async function getPlaylist() {
    const playlist = await mpvGetProperty('playlist') ?? []

    if (!Array.isArray(playlist)) {
        return []
    }

    return playlist.filter((item: any) => {
        const file = item.filename ?? item.path ?? ''

        if (!file) return false
        if (file === getActiveMusicPath()) return false
        if (path.resolve(file) === path.resolve(getActiveMusicPath())) return false

        return true
    })
}

function readMusicCrashState(): MusicCrashState | null {
    if (!existsSync(musicStatePath)) return null

    try {
        return JSON.parse(readFileSync(musicStatePath, 'utf8')) as MusicCrashState
    } catch (error) {
        logWarn('failed to read music crash state')
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
        return null
    }
}

function writeMusicCrashState(data: any) {
    const track = data?.track ?? {}
    const trackPath = track.path ?? null
    const filename = track.filename ?? (trackPath ? path.basename(trackPath) : null)

    if(suppressMusicStateWrite) return

    const state: MusicCrashState = {
        path: trackPath,
        filename,
        title: data?.title ?? track.title ?? '',
        artist: data?.artist ?? track.artist ?? '',
        progress: Number(data?.progress ?? track.progress ?? 0),
        duration: Number(data?.duration ?? track.duration ?? 0),
        paused: data?.status === 'paused' || track.pause === true,
        songrequest_enabled: songRequestEnabled,
        songrequest_active: songRequestEnabled,
        current_is_songrequest: typeof trackPath === 'string' && trackPath.startsWith(songRequestPath),
        songrequest_queue: songRequestQueue,
        songrequest_title_map: songRequestTitleMap,
        songrequest_blocklist: songRequestBlocklist,
        songrequest_current_index: currentRequestIndex,
        songrequest_current_url: data?.songrequest?.current_url ?? null,
        updated_at: new Date().toISOString(),
    }

    try {
        const tmpPath = `${musicStatePath}.tmp`
        writeFileSync(tmpPath, JSON.stringify(state, null, 2))
        renameSync(tmpPath, musicStatePath)
    } catch (error) {
        logWarn('failed to write music crash state')
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
    }
}

async function applyMusicCrashState() {
    const state = pendingMusicCrashState ?? readMusicCrashState()
    pendingMusicCrashState = null

    if (!state) return
    if (!state.path && !state.filename) return
    if (!mpvProcess || !existsSync(mpvSocketPath)) return

    logRegular('apply music crash state')

    if (Array.isArray(state.songrequest_queue)) {
        songRequestQueue = state.songrequest_queue
    }

    if (state.songrequest_title_map && typeof state.songrequest_title_map === 'object') {
        songRequestTitleMap = state.songrequest_title_map
    }

    if (Array.isArray(state.songrequest_blocklist)) {
        songRequestBlocklist = state.songrequest_blocklist
    }

    if (Number.isFinite(state.songrequest_current_index)) {
        currentRequestIndex = state.songrequest_current_index
    }

    const playlist = await getPlaylist()
    const wantedPath = state.path
    const wantedFilename = state.filename

    const index = playlist.findIndex((item: any) => {
        const itemPath = item.filename ?? item.path ?? ''

        if (wantedPath && itemPath === wantedPath) return true
        if (wantedPath && path.resolve(itemPath) === path.resolve(wantedPath)) return true
        if (wantedFilename && path.basename(itemPath) === wantedFilename) return true

        return false
    })

    if (index !== -1) {
        await mpvCommand(['set_property', 'playlist-pos', index])
    } else if (wantedPath && existsSync(wantedPath)) {
        await mpvCommand(['loadfile', wantedPath, 'replace'])
    } else {
        logWarn('music crash recovery skipped: previous song not found')
        return
    }

    await sleep(300)

    if (state.progress > 0) {
        await mpvCommand(['seek', state.progress / 1000, 'absolute'])
    }

    await mpvCommand(['set_property', 'pause', state.paused === true])

    logRegular(`music crash state restored: ${state.filename ?? state.path}`)
}

function startMusicUpdateInterval() {
    stopMusicUpdateInterval()

    musicUpdateInterval = setInterval(() => {
        sync().catch(error => {
            logWarn(`[mpv] music update failed: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`)
        })
    }, 1000)
}

function stopMusicUpdateInterval() {
    if (!musicUpdateInterval) return

    clearInterval(musicUpdateInterval)
    musicUpdateInterval = null
}

function startMpvEventListener() {
    stopMpvEventListener()

    if (!existsSync(mpvSocketPath)) return

    const socket = new Socket()
    let buffer = ''

    mpvEventSocket = socket

    socket.connect(mpvSocketPath, () => {
        socket.write(JSON.stringify({
            command: ['observe_property', 1, 'eof-reached'],
        }) + '\n')
    })

    socket.on('data', data => {
        buffer += data.toString()

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
            if (!line.trim()) continue

            try {
                const event = JSON.parse(line)

                if (
                    event.event === 'property-change' &&
                    event.name === 'eof-reached' &&
                    event.data === true
                ) {
                    handleSongFinished().catch(error => {
                        logWarn('song finish handler failed')
                        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
                    })
                }
            } catch {
                logDebug(`[mpv event] invalid response: ${line}`)
            }
        }
    })

    socket.on('error', error => {
        logDebug(`[mpv event] unavailable: ${error.message}`)
        stopMpvEventListener()
    })

    socket.on('close', () => {
        mpvEventSocket = null
    })
}

function stopMpvEventListener() {
    if (!mpvEventSocket) return

    mpvEventSocket.destroy()
    mpvEventSocket = null
}

async function handleSongFinished() {
    if (!songRequestEnabled) return
    if (songRequestBusy) return

    songRequestBusy = true

    try {
        await handleSongRequestNext()
        await sync()
    } finally {
        songRequestBusy = false
    }
}

async function handleSongRequestNext() {
    const currentPath = await mpvGetProperty('path')

    if (currentPath && currentPath.startsWith(songRequestPath) && existsSync(currentPath)) {
        const filename = path.basename(currentPath)

        delete songRequestTitleMap[filename]
        rmSync(currentPath, { force: true })
    }

    currentRequestIndex++

    await appendMissingDownloadedSongs()
}

async function prepareSongRequestCache() {
    mkdirSync(songRequestPath, { recursive: true })
}

async function ensureSongRequestDownloaded(index: number) {
    if (!songRequestQueue[index]) return

    await downloadSongRequest(songRequestQueue[index])
}

function getSongRequestFiles(): string[] {
    if (!existsSync(songRequestPath)) return []

    return readdirSync(songRequestPath)
        .map(file => path.join(songRequestPath, file))
}

async function removeFromPlaylist(filePath: string) {
    const playlist = await mpvGetProperty('playlist') ?? []

    if (!Array.isArray(playlist)) return

    const targetBase = path.basename(filePath)

    const index = playlist.findIndex((item: any) => {
        const itemPath = item.filename ?? item.path ?? ''

        return itemPath === filePath || path.basename(itemPath) === targetBase
    })

    if (index === -1) return

    await mpvCommand(['playlist-remove', index])
}

async function downloadSongRequest(url: string): Promise<void> {
    if (isYoutubeUrl(url)) {
        await downloadWithYtDlp(url)
        return
    }

    try {
        await downloadWithStreamrip(url)
        return
    } catch (error) {
        logWarn('streamrip failed')
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
    }

    throw new Error('songrequest download failed')
}

async function downloadWithStreamrip(url: string): Promise<void> {
    const command = await getStreamripCommand()

    logRegular(`download songrequest with ${command}: ${url}`)

    await runCommand(command, [
        '-ndb',
        '-f',
        songRequestPath,
        'url',
        url,
    ])
}

async function downloadWithYtDlp(url: string): Promise<void> {
    logRegular(`download songrequest with yt-dlp: ${url}`)

    await runCommand('yt-dlp', [
        '--extract-audio',
        '--audio-format',
        'mp3',
        '--audio-quality',
        '0',
        '--embed-metadata',
        '--parse-metadata',
        '%(artist,creator,uploader)s:%(meta_artist)s',
        '--parse-metadata',
        '%(title)s:%(meta_title)s',
        '--no-playlist',
        '-o',
        `${songRequestPath}/%(artist,creator,uploader)s - %(title).200B [%(id)s].%(ext)s`,
        url,
    ])
}

function normalizeSongRequestUrl(url: string): string {
    const parsed = new URL(url.trim())
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '')

    if (hostname === 'youtu.be') {
        const videoId = parsed.pathname.replace('/', '').trim()

        if (!videoId) throw new Error('Invalid YouTube URL.')

        return `https://www.youtube.com/watch?v=${videoId}`
    }

    if (['youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(hostname)) {
        const videoId = parsed.searchParams.get('v')

        if (!videoId) {
            throw new Error('Only single YouTube videos are supported.')
        }

        return `https://www.youtube.com/watch?v=${videoId}`
    }

    if (hostname === 'link.deezer.com') {
        return url.trim()
    }

    if (hostname === 'deezer.com' || hostname.endsWith('.deezer.com')) {
        const parts = parsed.pathname.split('/').filter(Boolean)
        const trackIndex = parts.indexOf('track')
        const trackId = trackIndex !== -1 ? parts[trackIndex + 1] : null

        if (!trackId) {
            throw new Error('Only single Deezer tracks are supported.')
        }

        return `https://www.deezer.com/track/${trackId}`
    }

    throw new Error('Only YouTube videos and Deezer tracks are supported.')
}

function isYoutubeUrl(url: string): boolean {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '')

    return ['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(hostname)
}

function clearSongRequestCache() {
    currentRequestIndex = 0
    songRequestQueue = []
    songRequestTitleMap = {}
    songRequestBusy = false

    if (existsSync(songRequestPath)) {
        rmSync(songRequestPath, { recursive: true, force: true })
    }

    mkdirSync(songRequestPath, { recursive: true })
}

async function mpvSetVolume(volume: number): Promise<void> {
    await setPipewireSinkOutputVolume(streambotMusicConfigName, volume)
}

async function mpvGetProperty(property: string): Promise<any> {
    const response = await mpvCommand(['get_property', property])

    return response?.data ?? null
}

async function mpvCommand(command: any[]): Promise<any> {
    if (!existsSync(mpvSocketPath)) return null

    logDebug(`[mpv ipc] ${JSON.stringify(command)}`)

    return new Promise(resolve => {
        const socket = new Socket()
        let buffer = ''
        let resolved = false

        const finish = (value: any = null) => {
            if (resolved) return

            resolved = true
            socket.destroy()
            resolve(value)
        }

        socket.connect(mpvSocketPath, () => {
            socket.write(JSON.stringify({ command }) + '\n')
        })

        socket.on('data', data => {
            buffer += data.toString()

            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const line of lines) {
                if (!line.trim()) continue

                try {
                    finish(JSON.parse(line))
                    return
                } catch {
                    logDebug(`[mpv ipc] invalid response: ${line}`)
                }
            }
        })

        socket.on('error', error => {
            logDebug(`[mpv ipc] unavailable: ${error.message}`)
            finish(null)
        })

        socket.on('close', () => finish(null))

        socket.setTimeout(1000, () => {
            logDebug('[mpv ipc] timeout')
            finish(null)
        })
    })
}

async function waitForMpvSocket() {
    for (let i = 0; i < 50; i++) {
        if (existsSync(mpvSocketPath)) return

        await sleep(100)
    }
}

function startCavaFeed() {
    stopCavaFeed()

    writeFileSync(cavaConfigPath, buildCavaConfig())

    cavaProcess = spawn('cava', ['-p', cavaConfigPath])

    cavaProcess.stdout.on('data', data => {
        getWebsocketServer().send('notify_music_cava', {
            raw: data.toString(),
        })
    })

    cavaProcess.stderr.on('data', data => {
        logDebug(`[cava] ${data.toString().trim()}`)
    })

    cavaProcess.on('exit', () => {
        cavaProcess = null
    })
}

function stopCavaFeed() {
    if (!cavaProcess) return

    cavaProcess.kill()
    cavaProcess = null
}

function buildCavaConfig(): string {
    const cavaGeneral = getConfig(/^cava_general$/g)[0] ?? {}
    const cavaInput = getConfig(/^cava_input$/g)[0] ?? {}
    const cavaOutput = getConfig(/^cava_output$/g)[0] ?? {}

    const general = {
        bars: 64,
        ...cavaGeneral,
    }

    const input = {
        method: 'pulse',
        ...cavaInput,
        source: `${streambotMusicSink}.monitor`,
    }

    const output = {
        method: 'raw',
        raw_target: '/dev/stdout',
        data_format: 'ascii',
        ascii_max_range: 100,
        ...cavaOutput,
    }

    return [
        renderCavaSection('general', general),
        renderCavaSection('input', input),
        renderCavaSection('output', output),
    ].join('\n\n')
}

function renderCavaSection(name: string, values: Record<string, any>): string {
    const lines = [`[${name}]`]

    for (const key in values) {
        if (values[key] === undefined || values[key] === null) continue

        lines.push(`${key} = ${values[key]}`)
    }

    return lines.join('\n')
}

function secondsToMs(value: any): number {
    const parsed = Number(value)

    if (!Number.isFinite(parsed)) return 0

    return Math.round(parsed * 1000)
}

function expandPath(input: string): string {
    return input
        .replace('$HOME', os.homedir())
        .replace(/^~/, os.homedir())
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function runCommand(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        execFile(command, args, (error, stdout, stderr) => {
            if (stdout) logDebug(stdout.trim())
            if (stderr) logWarn(stderr.trim())

            if (error) {
                reject(error)
                return
            }

            resolve()
        })
    })
}

function runCommandWithOutput(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile(command, args, (error, stdout, stderr) => {
            if (stderr) logWarn(stderr.trim())

            if (error) {
                reject(error)
                return
            }

            resolve(stdout)
        })
    })
}

async function appendMissingDownloadedSongs(): Promise<boolean> {
    if (!mpvProcess || !existsSync(mpvSocketPath)) return false

    const playlist = await getPlaylist()
    const playlistFiles = Array.isArray(playlist)
        ? playlist.map((item: any) => item.filename ?? item.path ?? '')
        : []

    let changed = false

    for (const file of getSongRequestFiles().filter(file => isMusicFile(file))) {
        if (!file || !existsSync(file)) continue
        if (playlistFiles.includes(file)) continue

        await mpvCommand(['loadfile', file, 'append-play'])
        changed = true
    }

    return changed
}

export function getRegularMusicFiles() {
    if (!existsSync(musicPath)) return []

    return readdirSync(musicPath)
        .filter(file => isMusicFile(file))
        .map(file => ({
            filename: file,
            path: path.join(musicPath, file),
        }))
}

export async function deleteRegularMusicFile(filename: string) {
    if (!filename) throw new Error('filename missing')

    const safeFilename = path.basename(filename)
    const targetFile = path.join(musicPath, safeFilename)

    if (!existsSync(targetFile)) {
        throw new Error('file not found')
    }

    const currentPath = await mpvGetProperty('path')
    const isCurrentSong = currentPath === targetFile || path.basename(currentPath ?? '') === safeFilename

    if (isCurrentSong) {
        await mpvCommand(['playlist-next', 'force'])
        await sleep(150)
    }

    await removeFromPlaylist(targetFile)

    rmSync(targetFile, { force: true })

    await sleep(150)
    await sync()

    return {
        deleted: true,
        filename: safeFilename,
    }
}

function isMusicFile(filename: string): boolean {
    return ['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.opus'].includes(
        path.extname(filename).toLowerCase(),
    )
}

export async function addRegularMusicFileFromUpload(file: any) {
    if (!file) throw new Error('file missing')

    const safeFilename = path.basename(file.originalname ?? file.name)

    if (!isMusicFile(safeFilename)) {
        throw new Error('invalid music file')
    }

    mkdirSync(musicPath, { recursive: true })

    const targetFile = path.join(musicPath, safeFilename)

    writeFileSync(targetFile, file.buffer)

    await mpvCommand(['loadfile', targetFile, 'append-play'])

    await sleep(150)
    await sync()

    return {
        added: true,
        filename: safeFilename,
    }
}

let streamripCommand: string | null = null

async function getStreamripCommand(): Promise<string> {
    if (streamripCommand) return streamripCommand

    for (const command of ['rip', 'streamrip']) {
        try {
            await runCommand(command, ['--help'])
            streamripCommand = command
            return command
        } catch {}
    }

    throw new Error('streamrip CLI not found. Expected either "rip" or "streamrip" in PATH.')
}

export function isSongRequestQueryBlocked(url: string): boolean {
    try {
        const normalizedUrl = normalizeSongRequestUrl(url);

        return songRequestBlocklist.includes(normalizedUrl);
    } catch {
        return false;
    }
}

export function isSongRequestQueryAlreadyPresent(url: string): boolean {
    try {
        const normalizedUrl = normalizeSongRequestUrl(url);

        return songRequestQueue.includes(normalizedUrl);
    } catch {
        return false;
    }
}