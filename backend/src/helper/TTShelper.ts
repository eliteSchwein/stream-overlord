import {getFullConfig} from "./ConfigHelper"
import {execute} from "./CommandHelper"
import {logDebug, logNotice, logWarn} from "./LogHelper"
import {getAudioData} from "./AudioHelper"
import {getArch, parsePath} from "./SystemHelper"
import {createWriteStream, existsSync, rmSync} from "node:fs"
import {mkdirSync} from "fs"
import {promisify} from "node:util"
import * as stream from "node:stream"
import axios from "axios"
import * as path from "node:path"
import getWebsocketServer from "../App"

const escapeRegex = /[\/'"]/

const HF_REPO = "rhasspy/piper-voices"
const HF_REV = "main"

let voices: Record<string, string[]> = {}

type HFEntry = {
    path: string
    type: "file" | "directory"
    size?: number
}

const finishedDownload = promisify(stream.finished)

/** List repo tree (handles pagination via Link: rel="next"). */
async function* hfListRepoTree(repo = HF_REPO, rev = HF_REV) {
    let url = `https://huggingface.co/api/models/${encodeURIComponent(repo)}/tree/${encodeURIComponent(rev)}?recursive=1`

    while (url) {
        const res = await axios.get(url, {
            responseType: "json",
            validateStatus: () => true,
            headers: { Accept: "application/json" },
        })
        if (res.status !== 200 || !Array.isArray(res.data)) {
            throw new Error(`HF tree fetch failed: ${res.status} ${res.statusText || ""}`)
        }
        for (const entry of res.data as HFEntry[]) yield entry

        const link: string | undefined =
            (res.headers["link"] as string | undefined) ||
            (res.headers["Link"] as string | undefined)
        const next = link
            ?.split(",")
            .map((s) => s.trim())
            .find((s) => /rel="?next"?$/i.test(s))
        url = next ? next.slice(next.indexOf("<") + 1, next.indexOf(">")) : ""
    }
}

/** Download one file from HF /resolve endpoint to destFile. */
async function hfDownloadFile(repoPath: string, destFile: string, repo = HF_REPO, rev = HF_REV) {
    const src = `https://huggingface.co/${repo}/resolve/${encodeURIComponent(rev)}/${repoPath}`
    const res = await axios.get(src, {
        responseType: "stream",
        validateStatus: () => true,
    })
    if (res.status !== 200) {
        throw new Error(`Download failed ${res.status} ${res.statusText} for ${repoPath}`)
    }
    const writer = createWriteStream(destFile)
    res.data.pipe(writer)
    await finishedDownload(writer)
}

/** Resolve the repo paths for the desired voice .onnx and its .onnx.json sidecar. */
async function resolveVoicePaths(modelSetting: string): Promise<{ onnxRepoPath: string, jsonRepoPath: string, basename: string }> {
    const desiredBase = path.basename(modelSetting).endsWith(".onnx")
        ? path.basename(modelSetting)
        : `${path.basename(modelSetting)}.onnx`

    let explicitRepoPath: string | null = null
    if (modelSetting.includes("/")) {
        // Caller provided a repo path normalize to .onnx
        const maybe = modelSetting.endsWith(".onnx") ? modelSetting : `${modelSetting}.onnx`
        explicitRepoPath = maybe.replace(/^\/+/, "")
    }

    let foundOnnx: string | undefined
    let foundJson: string | undefined

    for await (const entry of hfListRepoTree()) {
        if (entry.type !== "file") continue

        if (explicitRepoPath) {
            if (!foundOnnx && entry.path === explicitRepoPath) {
                foundOnnx = entry.path
            }
            // sidecar in same folder with same basename + ".json"
            const folder = path.posix.dirname(explicitRepoPath)
            const base = path.posix.basename(explicitRepoPath)
            if (!foundJson && entry.path === path.posix.join(folder, `${base}.json`)) {
                foundJson = entry.path
            }
        } else {
            // search by filename only (first match wins)
            if ((!foundOnnx && entry.path.endsWith(`/${desiredBase}`)) || (!foundOnnx && entry.path === desiredBase)) {
                foundOnnx = entry.path
            }
            if (!foundJson && (entry.path.endsWith(`/${desiredBase}.json`) || entry.path === `${desiredBase}.json`)) {
                foundJson = entry.path
            }
        }

        if (foundOnnx && foundJson) break
    }

    if (!foundOnnx) {
        throw new Error(
            explicitRepoPath
                ? `Voice model not found at '${explicitRepoPath}' in ${HF_REPO}@${HF_REV}`
                : `Voice model '${desiredBase}' not found in ${HF_REPO}@${HF_REV}`
        )
    }

    // If JSON not found yet, try derive by directory of foundOnnx
    if (!foundJson) {
        const dir = path.posix.dirname(foundOnnx)
        const base = path.posix.basename(foundOnnx)
        foundJson = path.posix.join(dir, `${base}.json`)
        // Download step will throw if this doesn't exist
    }

    return { onnxRepoPath: foundOnnx, jsonRepoPath: foundJson, basename: path.basename(foundOnnx) }
}

/** Download only the configured voice (config.model) into ${installPath}/models as flat files. */
export async function downloadVoice() {
    try {
        const cfg = getFullConfig()["tts"]
        if (!cfg || !cfg.location || !cfg.model) return

        const installPath = parsePath(cfg.location)
        const modelsDir = path.join(installPath, "models")
        mkdirSync(modelsDir, { recursive: true })

        // Resolve repo paths for .onnx and .onnx.json
        const { onnxRepoPath, jsonRepoPath, basename } = await resolveVoicePaths(`${cfg.model}.onnx`)

        const onnxDest = path.join(modelsDir, path.basename(basename))
        const jsonDest = `${onnxDest}.json`

        // Skip if already present
        const needOnnx = !existsSync(onnxDest)
        const needJson = !existsSync(jsonDest)

        if (!needOnnx && !needJson) {
            logNotice(`Voice already present: ${path.basename(onnxDest)} (+ .json)`)
            return
        }

        logNotice(`Downloading voice '${path.basename(onnxDest)}' to ${modelsDir}...`)

        if (needOnnx) {
            await hfDownloadFile(onnxRepoPath, onnxDest)
            logDebug(`Downloaded: ${onnxRepoPath} -> ${onnxDest}`)
        } else {
            logDebug(`Already exists: ${onnxDest}`)
        }

        if (needJson) {
            try {
                await hfDownloadFile(jsonRepoPath, jsonDest)
                logDebug(`Downloaded: ${jsonRepoPath} -> ${jsonDest}`)
            } catch (e: any) {
                logWarn(`Sidecar missing for '${path.basename(onnxDest)}': ${e?.message || e}`)
            }
        } else {
            logDebug(`Already exists: ${jsonDest}`)
        }

        logNotice(`Voice download complete.`)
    } catch (error) {
        logWarn(`Voice Download failed:`)
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
    }
}

export function getVoices(): Record<string, string[]> {
    return voices
}

export async function fetchVoices(): Promise<Record<string, string[]>> {
    voices = {}

    for await (const entry of hfListRepoTree()) {
        if (entry.type !== "file") continue

        // Only .onnx, but exclude .onnx.json
        if (/\.onnx$/i.test(entry.path) && !/\.onnx\.json$/i.test(entry.path)) {
            const name = path.posix.basename(entry.path, ".onnx")
            const lang = name.split("-")[0] // e.g. "ar_JO" from "ar_JO-kareem-low"

            if (!voices[lang]) voices[lang] = []
            voices[lang].push(name)
        }
    }

    // Sort each language’s voices
    for (const lang of Object.keys(voices)) {
        voices[lang].sort((a, b) => a.localeCompare(b))
    }

    getWebsocketServer().send("notify_voice_list_update", { voices })

    return voices
}

export async function installPiper() {
    const config = getFullConfig()["tts"]
    if (!config || !config.location) return
    const installPath = parsePath(config.location)

    if (existsSync(installPath) && existsSync(`${installPath}/piper`)) {
        if (!existsSync(`${installPath}/models`)) mkdirSync(`${installPath}/models`, { recursive: true })
        return
    }

    if (existsSync(installPath)) rmSync(installPath, { recursive: true })
    mkdirSync(installPath, { recursive: true })

    logNotice(`No piper found, downloading from GitHub...`)

    const downloadUrl: string = `https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_${getArch()}.tar.gz`
    const writer = createWriteStream(`${installPath}/piper.tar.gz`)

    const response = await axios({
        method: "GET",
        url: downloadUrl,
        responseType: "stream",
        validateStatus: () => true,
    })

    if (response.status !== 200) {
        throw new Error(`Piper binary download failed: ${response.status} ${response.statusText}`)
    }

    response.data.pipe(writer)
    await finishedDownload(writer)

    await execute(`tar -xzf ${installPath}/piper.tar.gz -C ${installPath}`)
    await execute(`rm ${installPath}/piper.tar.gz`)
    await execute(`mv ${installPath}/piper ${installPath}/piper-extract`)
    await execute(`mv ${installPath}/piper-extract/* ${installPath}`)
    await execute(`rm -r ${installPath}/piper-extract`)
    await execute(`chmod +x ${installPath}/piper`)
    await execute(`mkdir -p ${installPath}/models`)
}

export async function speak(message: string) {
    const config = getFullConfig()["tts"]
    const audioData = getAudioData()["tts"]

    if (audioData.muted) {
        logWarn(`TTS failed: muted`)
        return
    }

    let piperAttributes = ""
    if (config.enable_cuda) {
        piperAttributes = "--cuda"
    }

    message = message.replace(escapeRegex, "")

    try {
        let playCommand = config.play_command
        playCommand = playCommand.replace("${volume}", audioData["current_volume"])

        // Use only the filename placed in models/
        const modelFile = path.basename(String(config.model))

        const command = `bash -c "cd ${parsePath(
            config.location
        )} && echo '${message}' | ./piper ${piperAttributes} --model models/${modelFile}.onnx --output-raw | ${playCommand}"`

        logDebug(`TTS Command: ${command}`)
        await execute(command)
    } catch (error: any) {
        logWarn(`TTS failed:`)
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)))
    }
}

export function calculateTTSduration(text: string, speechRate = 150) {
    const wordCount = text.trim().split(/\s+/).length
    const duration = (wordCount / speechRate) * 60
    return Number.parseInt(duration.toFixed(0)) + 10
}
