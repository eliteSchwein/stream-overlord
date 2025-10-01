import { getFullConfig } from "./ConfigHelper";
import { execute } from "./CommandHelper";
import { logDebug, logNotice, logWarn } from "./LogHelper";
import { getAudioData } from "./AudioHelper";
import { getArch, parsePath } from "./SystemHelper";
import { createWriteStream, existsSync, rmSync, statSync } from "node:fs";
import { mkdirSync } from "fs";
import { promisify } from "node:util";
import * as stream from "node:stream";
import axios from "axios";
import * as path from "node:path";

const escapeRegex = /[\/'"]/;

const HF_REPO = "rhasspy/piper-voices";
const HF_REV = "main";

type HFEntry = {
    path: string;
    type: "file" | "directory";
    size?: number;
};

const finishedDownload = promisify(stream.finished);

/** List repo tree (handles pagination via Link: rel="next"). */
async function* hfListRepoTree(repo = HF_REPO, rev = HF_REV) {
    let url = `https://huggingface.co/api/models/${encodeURIComponent(
        repo
    )}/tree/${encodeURIComponent(rev)}?recursive=1`;

    while (url) {
        const res = await axios.get(url, {
            responseType: "json",
            validateStatus: () => true,
            headers: { Accept: "application/json" },
        });
        if (res.status !== 200 || !Array.isArray(res.data)) {
            throw new Error(
                `HF tree fetch failed: ${res.status} ${res.statusText || ""}`
            );
        }
        for (const entry of res.data as HFEntry[]) yield entry;

        const link: string | undefined =
            (res.headers["link"] as string | undefined) ||
            (res.headers["Link"] as string | undefined);
        const next = link
            ?.split(",")
            .map((s) => s.trim())
            .find((s) => /rel="?next"?$/i.test(s));
        url = next ? next.slice(next.indexOf("<") + 1, next.indexOf(">")) : "";
    }
}

/** Extract only the filename, e.g. 'en/en_US/joe/voice.onnx' -> 'voice.onnx' */
function toFlatFilename(repoPath: string): string {
    return path.basename(repoPath);
}

/** Download one file from HF /resolve endpoint to destFile. */
async function hfDownloadFile(
    repoPath: string,
    destFile: string,
    repo = HF_REPO,
    rev = HF_REV
) {
    const src = `https://huggingface.co/${repo}/resolve/${encodeURIComponent(
        rev
    )}/${repoPath}`;
    const res = await axios.get(src, {
        responseType: "stream",
        validateStatus: () => true,
    });
    if (res.status !== 200) {
        throw new Error(
            `Download failed ${res.status} ${res.statusText} for ${repoPath}`
        );
    }
    const writer = createWriteStream(destFile);
    res.data.pipe(writer);
    await finishedDownload(writer);
}

/** Very small promise pool. */
async function promisePool<T, R>(
    items: T[],
    limit: number,
    worker: (item: T) => Promise<R>
) {
    const results: Promise<R>[] = [];
    const executing = new Set<Promise<R>>();
    for (const item of items) {
        const p = Promise.resolve().then(() => worker(item));
        results.push(p);
        executing.add(p);
        const clean = () => executing.delete(p);
        p.then(clean, clean);
        if (executing.size >= limit) await Promise.race(executing);
    }
    return Promise.allSettled(results);
}

/**
 * Download all Piper voices (.onnx and .onnx.json) into `${installPath}/models` (flat).
 * Skips files that already exist (by flattened filename).
 */
export async function downloadAllPiperVoices(
    installPath: string,
    {
        concurrency = 4,
        dryRun = false,
        include = [/\.onnx$/i, /\.onnx\.json$/i],
        exclude = [/\.md$/i, /LICENSE/i],
    }: {
        concurrency?: number;
        dryRun?: boolean;
        include?: RegExp[];
        exclude?: RegExp[];
    } = {}
) {
    const modelsDir = `${installPath}/models`;
    if (!existsSync(modelsDir)) mkdirSync(modelsDir, { recursive: true });

    const candidates: { repoPath: string; outFile: string }[] = [];
    for await (const entry of hfListRepoTree()) {
        if (entry.type !== "file") continue;
        const ok =
            include.some((rx) => rx.test(entry.path)) &&
            !exclude.some((rx) => rx.test(entry.path));
        if (!ok) continue;

        const outFile = `${modelsDir}/${toFlatFilename(entry.path)}`;
        if (existsSync(outFile)) {
            // Already present; skip.
            continue;
        }
        candidates.push({ repoPath: entry.path, outFile });
    }

    if (candidates.length === 0) {
        logNotice("No new Piper voice artifacts to download.");
        return;
    }

    logNotice(`Downloading ${candidates.length} Piper voice files to ${modelsDir}...`);
    if (dryRun) {
        for (const c of candidates) logDebug(`Would download: ${c.repoPath} -> ${c.outFile}`);
        return;
    }

    const results = await promisePool(
        candidates,
        concurrency,
        async ({ repoPath, outFile }) => {
            await hfDownloadFile(repoPath, outFile);
            logDebug(`Downloaded: ${repoPath}`);
            return outFile;
        }
    );

    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    if (failed.length) {
        logWarn(`${failed.length} voice file(s) failed to download.`);
        for (const f of failed) logWarn(String(f.reason));
    } else {
        logNotice("All Piper voice files downloaded.");
    }
}

export async function installPiper() {
    const config = getFullConfig()["tts"];
    if (!config || !config.location) return;
    const installPath = parsePath(config.location);

    if (existsSync(installPath) && existsSync(`${installPath}/piper`)) {
        // Ensure models directory exists even if piper already present
        if (!existsSync(`${installPath}/models`)) mkdirSync(`${installPath}/models`, { recursive: true });
        // Also ensure we have voices
        await downloadAllPiperVoices(installPath).catch((e) =>
            logWarn(`Voice download failed: ${e?.message || e}`)
        );
        return;
    }

    if (existsSync(installPath)) rmSync(installPath, { recursive: true });
    mkdirSync(installPath, { recursive: true });

    logNotice(`No piper found, downloading from GitHub...`);

    const downloadUrl: string = `https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_${getArch()}.tar.gz`;
    const writer = createWriteStream(`${installPath}/piper.tar.gz`);

    const response = await axios({
        method: "GET",
        url: downloadUrl,
        responseType: "stream",
        validateStatus: () => true,
    });

    if (response.status !== 200) {
        throw new Error(
            `Piper binary download failed: ${response.status} ${response.statusText}`
        );
    }

    response.data.pipe(writer);
    await finishedDownload(writer);

    await execute(`tar -xzf ${installPath}/piper.tar.gz -C ${installPath}`);
    await execute(`rm ${installPath}/piper.tar.gz`);
    await execute(`mv ${installPath}/piper ${installPath}/piper-extract`);
    await execute(`mv ${installPath}/piper-extract/* ${installPath}`);
    await execute(`rm -r ${installPath}/piper-extract`);
    await execute(`chmod +x ${installPath}/piper`);
    await execute(`mkdir -p ${installPath}/models`);

    await downloadAllPiperVoices(installPath).catch((e) =>
        logWarn(`Voice download failed: ${e?.message || e}`)
    );
}

export async function speak(message: string) {
    const config = getFullConfig()["tts"];
    const audioData = getAudioData()["tts"];

    if (audioData.muted) {
        logWarn(`TTS failed: muted`);
        return;
    }

    let piperAttributes = "";

    if (config.enable_cuda) {
        piperAttributes = "--cuda";
    }

    message = message.replace(escapeRegex, "");

    try {
        let playCommand = config.play_command;
        playCommand = playCommand.replace("${volume}", audioData["current_volume"]);

        const command = `bash -c "cd ${parsePath(
            config.location
        )} && echo '${message}' | ./piper ${piperAttributes} --model models/${
            config.model
        } --output-raw | ${playCommand}"`;

        logDebug(`TTS Command: ${command}`);
        await execute(command);
    } catch (error: any) {
        logWarn(`TTS failed:`);
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
}

export function calculateTTSduration(text: string, speechRate = 150) {
    const wordCount = text.trim().split(/\s+/).length;
    const duration = (wordCount / speechRate) * 60;
    return Number.parseInt(duration.toFixed(0)) + 10;
}
