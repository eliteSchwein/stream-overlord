import {getTtsSettings} from "./ConfigHelper"
import {executeProcess} from "./CommandHelper"
import {logDebug, logError, logNotice, logSuccess, logWarn} from "./LogHelper"
import {getAudioData, getStreambotSinkName} from "./AudioHelper"
import {createWriteStream, existsSync, mkdirSync, rmSync} from "node:fs"
import {execFileSync, spawn} from "node:child_process"
import {promisify} from "node:util"
import * as stream from "node:stream"
import axios from "axios"
import * as path from "node:path"
import * as os from "node:os"
import getWebsocketServer from "../App"

const HF_REPO = "rhasspy/piper-voices"
const HF_REV = "main"
const DEFAULT_PLAY_COMMAND = "pw-play --raw --rate 22050 --channels 1 --format s16 --target ${sink} -"

let voices: Record<string, string[]> = {}

type HFEntry = {
    path: string
    type: "file" | "directory"
    size?: number
}

const finishedDownload = promisify(stream.finished)
const activeSpeechProcesses: Record<string, any> = {}
let installPromise: Promise<void> | null = null
let syncPromise: Promise<void> | null = null

function getInstallScript() {
    const candidates = [
        path.resolve(__dirname, "../../scripts/install_tts.sh"),
        path.resolve(process.cwd(), "scripts/install_tts.sh"),
    ]

    const script = candidates.find((candidate) => existsSync(candidate))
    if (!script) throw new Error("scripts/install_tts.sh not found")
    return script
}

function runInstaller(script: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn("bash", [script], {stdio: ["ignore", "pipe", "pipe"]})

        child.stdout?.on("data", (chunk: any) => {
            for (const line of String(chunk ?? "").split(/\r?\n/).map((v) => v.trim()).filter(Boolean)) {
                logNotice(`tts install: ${line}`)
            }
        })
        child.stderr?.on("data", (chunk: any) => {
            for (const line of String(chunk ?? "").split(/\r?\n/).map((v) => v.trim()).filter(Boolean)) {
                logWarn(`tts install: ${line}`)
            }
        })
        child.once("error", reject)
        child.once("exit", (code: number | null, signal: string | null) => {
            if (code === 0) return resolve()
            reject(new Error(`TTS installer exited with ${code ?? signal ?? "unknown status"}`))
        })
    })
}

export function getTtsRoot() {
    return path.join(os.homedir(), ".local", "share", "streambot", "tts")
}

function getPiperBinary() {
    return path.join(getTtsRoot(), "piper")
}

function getModelsDirectory() {
    return path.join(getTtsRoot(), "models")
}

export function isTtsInstalled() {
    return existsSync(getPiperBinary())
}

export function getConfiguredTtsVoices(): Record<string, string> {
    const configured = (getTtsSettings() as any)?.voices
    if (!configured || typeof configured !== "object" || Array.isArray(configured)) return {}

    const result: Record<string, string> = {}
    for (const [locale, voice] of Object.entries(configured)) {
        const normalizedLocale = String(locale ?? "").trim()
        const normalizedVoice = String(voice ?? "").trim().replace(/\.onnx$/i, "")
        if (normalizedLocale && normalizedVoice) result[normalizedLocale] = normalizedVoice
    }
    return result
}

export function interruptSpeechByEventUuid(eventUuid: string | undefined) {
    if (!eventUuid) return
    const process = activeSpeechProcesses[eventUuid]
    if (!process) return

    try {
        process.kill("SIGTERM")
    } catch (_) {}

    delete activeSpeechProcesses[eventUuid]
}

async function* hfListRepoTree(repo = HF_REPO, rev = HF_REV) {
    let url = `https://huggingface.co/api/models/${repo}/tree/${encodeURIComponent(rev)}?recursive=1`

    while (url) {
        const res = await axios.get(url, {
            responseType: "json",
            validateStatus: () => true,
            headers: {Accept: "application/json"},
        })

        if (res.status !== 200 || !Array.isArray(res.data)) {
            logError(`HF tree fetch failed: ${res.status} ${res.statusText || ""}`)
            logDebug(`${url}`)
            return
        }

        for (const entry of res.data as HFEntry[]) yield entry

        const link: string | undefined =
            (res.headers["link"] as string | undefined) ||
            (res.headers["Link"] as string | undefined)
        const next = link
            ?.split(",")
            .map((value) => value.trim())
            .find((value) => /rel="?next"?$/i.test(value))
        url = next ? next.slice(next.indexOf("<") + 1, next.indexOf(">")) : ""
    }
}

async function hfDownloadFile(repoPath: string, destFile: string, repo = HF_REPO, rev = HF_REV) {
    const src = `https://huggingface.co/${repo}/resolve/${encodeURIComponent(rev)}/${repoPath}`
    const res = await axios.get(src, {
        responseType: "stream",
        validateStatus: () => true,
    })

    if (res.status !== 200) {
        throw new Error(`download failed ${res.status} ${res.statusText} for ${repoPath}`)
    }

    const writer = createWriteStream(destFile)
    res.data.pipe(writer)
    await finishedDownload(writer)
}

async function resolveVoicePaths(modelSetting: string): Promise<{onnxRepoPath: string, jsonRepoPath: string, basename: string} | undefined> {
    const desiredBase = path.basename(modelSetting).endsWith(".onnx")
        ? path.basename(modelSetting)
        : `${path.basename(modelSetting)}.onnx`

    let explicitRepoPath: string | null = null
    if (modelSetting.includes("/")) {
        explicitRepoPath = (modelSetting.endsWith(".onnx") ? modelSetting : `${modelSetting}.onnx`).replace(/^\/+/, "")
    }

    let foundOnnx: string | undefined
    let foundJson: string | undefined

    for await (const entry of hfListRepoTree()) {
        if (entry.type !== "file") continue

        if (explicitRepoPath) {
            if (!foundOnnx && entry.path === explicitRepoPath) foundOnnx = entry.path

            const folder = path.posix.dirname(explicitRepoPath)
            const base = path.posix.basename(explicitRepoPath)
            if (!foundJson && entry.path === path.posix.join(folder, `${base}.json`)) foundJson = entry.path
        } else {
            if (!foundOnnx && (entry.path.endsWith(`/${desiredBase}`) || entry.path === desiredBase)) foundOnnx = entry.path
            if (!foundJson && (entry.path.endsWith(`/${desiredBase}.json`) || entry.path === `${desiredBase}.json`)) foundJson = entry.path
        }

        if (foundOnnx && foundJson) break
    }

    if (!foundOnnx) {
        logWarn(`TTS voice '${modelSetting}' not found in ${HF_REPO}@${HF_REV}`)
        return undefined
    }

    if (!foundJson) {
        const dir = path.posix.dirname(foundOnnx)
        const base = path.posix.basename(foundOnnx)
        foundJson = path.posix.join(dir, `${base}.json`)
    }

    return {onnxRepoPath: foundOnnx, jsonRepoPath: foundJson, basename: path.basename(foundOnnx)}
}

export async function downloadVoice(locale?: string) {
    const configured = getConfiguredTtsVoices()
    const entries = locale
        ? Object.entries(configured).filter(([configuredLocale]) => configuredLocale === locale)
        : Object.entries(configured)

    if (!entries.length) return

    try {
        if (!(getTtsSettings() as any)?.enabled) return
        if (!isTtsInstalled()) {
            logWarn(`TTS voice download skipped: TTS is not installed`)
            return
        }
        mkdirSync(getModelsDirectory(), {recursive: true})

        for (const [configuredLocale, voice] of entries) {
            const resolved = await resolveVoicePaths(voice)
            if (!resolved) continue

            const onnxDest = path.join(getModelsDirectory(), path.basename(resolved.basename))
            const jsonDest = `${onnxDest}.json`
            const needOnnx = !existsSync(onnxDest)
            const needJson = !existsSync(jsonDest)

            if (!needOnnx && !needJson) {
                logNotice(`TTS voice already present: ${configuredLocale} -> ${voice}`)
                continue
            }

            logNotice(`Downloading TTS voice ${configuredLocale} -> ${voice}`)
            if (needOnnx) await hfDownloadFile(resolved.onnxRepoPath, onnxDest)
            if (needJson) await hfDownloadFile(resolved.jsonRepoPath, jsonDest)
        }

    } catch (error: any) {
        logWarn(`TTS voice download failed: ${error?.message ?? error}`)
    }
}

export const downloadVoices = downloadVoice

export function getVoices(): Record<string, string[]> {
    return voices
}

export async function fetchVoices(): Promise<Record<string, string[]>> {
    voices = {}

    for await (const entry of hfListRepoTree()) {
        if (entry.type !== "file") continue
        if (!/\.onnx$/i.test(entry.path) || /\.onnx\.json$/i.test(entry.path)) continue

        const name = path.posix.basename(entry.path, ".onnx")
        const locale = name.split("-")[0]
        if (!voices[locale]) voices[locale] = []
        voices[locale].push(name)
    }

    for (const locale of Object.keys(voices)) {
        voices[locale].sort((a, b) => a.localeCompare(b))
    }

    getWebsocketServer().send("notify_voice_list_update", {voices})
    return voices
}

export async function installTts(force = false) {
    if (!force && isTtsInstalled()) return
    if (installPromise) return installPromise

    installPromise = (async () => {
        try {
            const script = getInstallScript()
            logNotice(`install TTS from ${script}`)
            await runInstaller(script)

            if (!isTtsInstalled()) {
                throw new Error("TTS installer finished but piper is missing")
            }

            logSuccess(`TTS installation is ready`)
        } finally {
            installPromise = null
        }
    })()

    return installPromise
}

export const installPiper = installTts

export async function purgeTts() {
    if (installPromise) {
        await installPromise.catch(() => undefined)
    }

    const root = getTtsRoot()
    if (!existsSync(root)) return

    rmSync(root, {recursive: true, force: true})
    logSuccess(`TTS purged from ${root}`)
}

export async function syncTtsSettings(forceInstall = false) {
    if (syncPromise) return syncPromise

    syncPromise = (async () => {
        const settings = getTtsSettings() as any

        if (!settings?.enabled) {
            await purgeTts()
            return
        }

        const wasInstalled = isTtsInstalled()
        await installTts(forceInstall || !wasInstalled)
        await downloadVoice()
    })().finally(() => {
        syncPromise = null
    })

    return syncPromise
}

export async function speak(
    message: string,
    eventUuid: string | undefined = undefined,
    locale: string | undefined = undefined,
) {
    const settings = getTtsSettings() as any
    if (!settings?.enabled) {
        logWarn(`TTS failed: TTS is disabled`)
        return
    }

    const audioData = getAudioData()["tts"]
    if (!audioData) {
        logWarn(`TTS failed: missing tts audio config`)
        return
    }
    if (audioData.muted) {
        logWarn(`TTS failed: muted`)
        return
    }

    const configuredVoices = getConfiguredTtsVoices()
    const selectedLocale = String(locale ?? "").trim()
    if (!selectedLocale) {
        logWarn(`TTS failed: locale is required`)
        return
    }

    const voice = configuredVoices[selectedLocale]
    if (!voice) {
        logWarn(`TTS failed: no voice configured for locale '${selectedLocale}'`)
        return
    }
    if (!isTtsInstalled()) {
        logWarn(`TTS failed: Piper is not installed`)
        return
    }

    const modelPath = path.join(getModelsDirectory(), `${path.basename(voice)}.onnx`)
    if (!existsSync(modelPath)) {
        logWarn(`TTS failed: voice '${voice}' for locale '${selectedLocale}' is not downloaded`)
        return
    }

    const piperAttributes = shouldUseCuda() ? "--cuda" : ""

    try {
        const sinkName = getStreambotSinkName("tts")
        const playCommand = DEFAULT_PLAY_COMMAND
            .replace(/\$\{sink}/g, shellEscape(sinkName))
            .replace(/\$\{audio_sink}/g, shellEscape(sinkName))
            .replace(/\$\{audio_device}/g, shellEscape(sinkName))

        const encodedMessage = Buffer.from(String(message), "utf8").toString("base64")
        const command = `bash -o pipefail -c "printf '%s' '${encodedMessage}' | base64 -d | ${shellEscape(getPiperBinary())} ${piperAttributes} --model ${shellEscape(modelPath)} --output-raw | ${playCommand}"`

        logDebug(`TTS locale=${selectedLocale} voice=${voice}`)
        const execution = await executeProcess(command)

        if (eventUuid) activeSpeechProcesses[eventUuid] = execution.process

        try {
            await execution.promise
        } finally {
            if (eventUuid) delete activeSpeechProcesses[eventUuid]
        }
    } catch (error: any) {
        logWarn(`TTS failed: ${error?.message ?? error}`)
    }
}

function shouldUseCuda(): boolean {
    if (["0", "false", "off", "no"].includes(String(process.env.PIPER_AUTO_CUDA || "").trim().toLowerCase())) return false

    try {
        if (existsSync("/dev/nvidiactl") || existsSync("/dev/nvidia0")) return true
    } catch (_) {}

    try {
        execFileSync("nvidia-smi", ["-L"], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        })
        return true
    } catch (_) {
        return false
    }
}

function shellEscape(value: string): string {
    return `'${String(value).replace(/'/g, `'\\''`)}'`
}

export function calculateTTSduration(text: string, speechRate = 150) {
    const wordCount = text.trim().split(/\s+/).length
    const duration = (wordCount / speechRate) * 60
    return Number.parseInt(duration.toFixed(0)) + 10
}
