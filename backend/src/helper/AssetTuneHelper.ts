import { getConfig } from "./ConfigHelper";
import * as path from "node:path";
import * as fs from "node:fs";
import { execFileSync } from "node:child_process";
import { getGpu } from "./SystemInfoHelper";
import { isDebug, logDebug, logError, logNotice, logRegular, logWarn } from "./LogHelper";
import { imageRegex, videoRegex } from "./AssetHelper";
import { existsSync } from "node:fs";

type FfmpegInit = {
    ffmpegBin: string;
    ffprobeBin: string;
    inputArgs: string[];
    outputArgs: string[];
    vaapiDevice: string;
};

type VideoProbe = {
    codecName: string | null;
    pixFmt: string | null;
    alphaMode: string | null;
    hasAlpha: boolean;
};

export async function compressAssets(
    force: boolean = false,
    file?: string
) {
    const config = getConfig(/asset_tune/g)[0];

    const assetDirectory = path.resolve(__dirname, "../../assets");
    const compressedAssetDirectory = path.resolve(__dirname, "../../compressed_assets");

    let videoAssets: string[] = [];
    let imageAssets: string[] = [];

    if (file) {
        if (!fs.existsSync(file)) {
            logWarn(`File not found: ${file}`);
            return;
        }

        if (!file.startsWith(assetDirectory)) {
            logWarn(`File must be inside assets directory: ${assetDirectory}`);
            return;
        }

        if (testRegex(videoRegex, file)) videoAssets = [file];
        else if (testRegex(imageRegex, file)) imageAssets = [file];
        else {
            logWarn(`Unsupported file type: ${file}`);
            return;
        }
    } else {
        videoAssets = getAssetFiles(videoRegex, assetDirectory);
        imageAssets = getAssetFiles(imageRegex, assetDirectory);
    }

    const ffmpeg = await initFfmpeg();
    const { ffmpegBin, ffprobeBin } = ffmpeg;

    if (force) logWarn("Force compressing assets");
    if (file) force = true;

    const imageQuality = numberArg(config?.image_compress_percent, 75);
    const imageCompressionLevel = numberArg(config?.image_compress_level, 4);

    const ensureParentDir = (outPath: string) => {
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
    };

    // ---- Videos -> .webm ----
    if (videoAssets.length) logRegular(`Compressing ${videoAssets.length} video asset(s)...`);

    for (const videoAsset of videoAssets) {
        const targetVideoAsset = videoAsset
            .replace(videoRegex, ".webm")
            .replace(assetDirectory, compressedAssetDirectory);

        ensureParentDir(targetVideoAsset);

        if (fs.existsSync(targetVideoAsset) && !force) continue;
        if (fs.existsSync(targetVideoAsset) && force) fs.unlinkSync(targetVideoAsset);

        logNotice(`Compressing ${videoAsset} to ${targetVideoAsset}`);

        const probe = probeVideo(ffprobeBin, videoAsset);
        const args = buildVideoTranscodeArgs(videoAsset, targetVideoAsset, ffmpeg, probe);

        logDebug(`${ffmpegBin} ${args.map(shellPreviewArg).join(" ")}`);

        try {
            execFileSync(ffmpegBin, args, {
                encoding: "utf8",
                stdio: ["ignore", "pipe", "pipe"],
            });
        } catch (error: any) {
            if (isDebug()) {
                logError(`Compressing ${videoAsset} failed:`);
                logError(error.stderr?.toString?.() || error.message || String(error));
                continue;
            }
            logError(`Compressing ${videoAsset} failed`);
        }
    }

    // ---- Images -> .webp ----
    if (imageAssets.length) logRegular(`Compressing ${imageAssets.length} image asset(s)...`);

    for (const imageAsset of imageAssets) {
        const targetImageAsset = imageAsset
            .replace(imageRegex, ".webp")
            .replace(assetDirectory, compressedAssetDirectory);

        ensureParentDir(targetImageAsset);

        if (fs.existsSync(targetImageAsset) && !force) continue;
        if (fs.existsSync(targetImageAsset) && force) fs.unlinkSync(targetImageAsset);

        logNotice(`Compressing ${imageAsset} to ${targetImageAsset}`);

        const args = [
            "-i", imageAsset,
            "-c:v", "libwebp",
            "-q:v", String(imageQuality),
            "-compression_level", String(imageCompressionLevel),
            targetImageAsset,
        ];

        logDebug(`${ffmpegBin} ${args.map(shellPreviewArg).join(" ")}`);

        try {
            execFileSync(ffmpegBin, args, {
                encoding: "utf8",
                stdio: ["ignore", "pipe", "pipe"],
            });
        } catch (error: any) {
            if (isDebug()) {
                logError(`Compressing ${imageAsset} failed:`);
                logError(error.stderr?.toString?.() || error.message || String(error));
                continue;
            }
            logError(`Compressing ${imageAsset} failed`);
        }
    }
}

async function initFfmpeg(): Promise<FfmpegInit> {
    const config = getConfig(/asset_tune/g)[0];

    const ffmpegBin = (
        (config?.ffmpeg?.bin as string) ||
        process.env.FFMPEG_BIN ||
        "ffmpeg"
    ).trim();

    const ffprobeBin = (
        (config?.ffprobe?.bin as string) ||
        process.env.FFPROBE_BIN ||
        "ffprobe"
    ).trim();

    const forceCodec = (
        (config?.codec as string) ||
        process.env.VIDEO_PROCESSING_CODEC ||
        process.env.VIDEO_PROCCESSING_CODEC ||
        "vp9"
    ).trim().toLowerCase();

    const runAndCapture = (bin: string, args: string[]) => {
        try {
            return execFileSync(bin, args, {
                encoding: "utf8",
                stdio: ["ignore", "pipe", "pipe"],
            });
        } catch (e: any) {
            return (e?.stdout?.toString?.() || e?.stderr?.toString?.() || "") as string;
        }
    };

    const isReadable = (p: string) => {
        try {
            fs.accessSync(p, fs.constants.R_OK);
            return true;
        } catch {
            return false;
        }
    };

    const gfx = getGpu();
    const controllers = gfx.controllers || [];
    const vendorStr = (v?: string) => (v || "").toLowerCase();

    const hasIntelGPU = controllers.some((c) => /intel/.test(vendorStr(c.vendor)));
    const hasNvidiaGPU = controllers.some((c) => /nvidia/.test(vendorStr(c.vendor)));

    const encoders = runAndCapture(ffmpegBin, ["-hide_banner", "-v", "error", "-encoders"]);
    const accels = runAndCapture(ffmpegBin, ["-hide_banner", "-v", "error", "-hwaccels"]);

    const haveNvenc = /\bav1_nvenc\b/.test(encoders);
    const haveQsv = /\bav1_qsv\b/.test(encoders);
    const haveVaapi = /\bav1_vaapi\b/.test(encoders);
    const haveSVT = /\blibsvtav1\b/.test(encoders);
    const haveAOM = /\blibaom-av1\b/.test(encoders);

    const vaapiDevice = (process.env.VAAPI_DEVICE || "/dev/dri/renderD128").trim();
    const vaapiDeviceOk = isReadable(vaapiDevice);

    const nvencAllowed = !config?.disable_nv && haveNvenc && hasNvidiaGPU;
    const qsvAllowed = !config?.disable_qsv && haveQsv && hasIntelGPU && vaapiDeviceOk;
    const vaapiAllowed = !Boolean((config as any)?.disable_vaapi) && haveVaapi && vaapiDeviceOk;

    let inputArgs: string[] = [];
    let outputArgs: string[] = [];

    if (forceCodec === "av1") {
        if (nvencAllowed) {
            inputArgs = /\bcuda\b/i.test(accels) ? ["-hwaccel", "cuda"] : [];
            outputArgs = [
                "-c:v", "av1_nvenc",
                "-preset", "p5",
                "-b:v", "5M",
                "-maxrate", "5M",
                "-c:a", "libopus",
                "-b:a", "128k",
            ];
        } else if (qsvAllowed) {
            inputArgs = /\bqsv\b/i.test(accels) ? ["-hwaccel", "qsv"] : [];
            outputArgs = [
                "-c:v", "av1_qsv",
                "-preset", "medium",
                "-b:v", "5M",
                "-maxrate", "5M",
                "-c:a", "libopus",
                "-b:a", "128k",
            ];
        } else if (vaapiAllowed) {
            inputArgs = [
                "-hwaccel", "vaapi",
                "-vaapi_device", vaapiDevice,
            ];
            outputArgs = [
                "-vf", "format=nv12,hwupload",
                "-c:v", "av1_vaapi",
                "-b:v", "5M",
                "-maxrate", "5M",
                "-c:a", "libopus",
                "-b:a", "128k",
            ];
        } else if (haveSVT) {
            outputArgs = [
                "-c:v", "libsvtav1",
                "-preset", "6",
                "-crf", "30",
                "-b:v", "0",
                "-c:a", "libopus",
                "-b:a", "128k",
            ];
        } else if (haveAOM) {
            outputArgs = [
                "-c:v", "libaom-av1",
                "-crf", "30",
                "-b:v", "0",
                "-c:a", "libopus",
                "-b:a", "128k",
            ];
        } else {
            outputArgs = [
                "-c:v", "libvpx-vp9",
                "-crf", "30",
                "-b:v", "0",
                "-c:a", "libopus",
                "-b:a", "128k",
            ];
        }
    } else {
        outputArgs = [
            "-c:v", "libvpx-vp9",
            "-crf", "30",
            "-b:v", "0",
            "-c:a", "libopus",
            "-b:a", "128k",
        ];
    }

    return { ffmpegBin, ffprobeBin, inputArgs, outputArgs, vaapiDevice };
}

function probeVideo(ffprobeBin: string, file: string): VideoProbe {
    try {
        const raw = execFileSync(
            ffprobeBin,
            [
                "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "stream=codec_name,pix_fmt:stream_tags=alpha_mode",
                "-of", "json",
                file,
            ],
            {
                encoding: "utf8",
                stdio: ["ignore", "pipe", "pipe"],
            }
        );

        const parsed = JSON.parse(raw);
        const stream = parsed?.streams?.[0] || {};
        const codecName = nullableString(stream.codec_name);
        const pixFmt = nullableString(stream.pix_fmt);
        const alphaMode = nullableString(stream?.tags?.alpha_mode);

        const hasAlpha =
            Boolean(alphaMode && alphaMode !== "0") ||
            isAlphaPixelFormat(pixFmt);

        return {
            codecName,
            pixFmt,
            alphaMode,
            hasAlpha,
        };
    } catch {
        return {
            codecName: null,
            pixFmt: null,
            alphaMode: null,
            hasAlpha: false,
        };
    }
}

function buildVideoTranscodeArgs(
    inputFile: string,
    outputFile: string,
    ffmpeg: FfmpegInit,
    probe: VideoProbe
): string[] {
    const ext = path.extname(inputFile).toLowerCase();
    const isWebm = ext === ".webm";
    const isVp8 = probe.codecName === "vp8";
    const isVp9 = probe.codecName === "vp9";
    const isAlphaWebmVpX = probe.hasAlpha && isWebm && (isVp8 || isVp9);

    // For alpha sources, force a VP9 + yuva420p output path.
    // For alpha WebM VP8/VP9 sources, also force the input decoder BEFORE -i.
    if (probe.hasAlpha) {
        const inputArgs = isAlphaWebmVpX
            ? (isVp8 ? ["-c:v", "libvpx"] : ["-c:v", "libvpx-vp9"])
            : [];

        const outputArgs = [
            "-c:v", "libvpx-vp9",
            "-pix_fmt", "yuva420p",
            "-crf", "30",
            "-b:v", "0",
            "-c:a", "libopus",
            "-b:a", "128k",
        ];

        return [
            ...inputArgs,
            "-i", inputFile,
            ...outputArgs,
            outputFile,
        ];
    }

    return [
        ...ffmpeg.inputArgs,
        "-i", inputFile,
        ...ffmpeg.outputArgs,
        outputFile,
    ];
}

function numberArg(value: unknown, fallback: number): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function nullableString(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isAlphaPixelFormat(pixFmt: string | null): boolean {
    if (!pixFmt) return false;

    const pf = pixFmt.toLowerCase();

    return (
        pf.startsWith("yuva") ||
        pf.includes("rgba") ||
        pf.includes("bgra") ||
        pf.includes("argb") ||
        pf.includes("abgr") ||
        pf.includes("gbrap") ||
        pf.includes("ya")
    );
}

function testRegex(regex: RegExp, value: string): boolean {
    regex.lastIndex = 0;
    return regex.test(value);
}

function shellPreviewArg(value: string): string {
    if (!/[\s"'\\]/.test(value)) return value;
    return JSON.stringify(value);
}

export function getAssetFile(file: string) {
    if (!file) return null;

    if (!testRegex(videoRegex, file) && !testRegex(imageRegex, file)) return file;

    const compressedAssetDirectory = path.resolve(__dirname, "../../compressed_assets");

    const compressedFile = file
        .replace(imageRegex, ".webp")
        .replace(videoRegex, ".webm");

    if (existsSync(`${compressedAssetDirectory}/${compressedFile}`)) {
        return {
            original: file,
            compressed: `compressed/${compressedFile}`,
        };
    }

    return {
        original: file,
        compressed: null,
    };
}

// TODO: move this to the new assets helper
export function getAssetFiles(
    query: string | string[] | RegExp,
    dir: string = path.resolve(__dirname, "../../assets")
): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    const matches = (filename: string): boolean => {
        if (query instanceof RegExp) {
            query.lastIndex = 0;
            return query.test(filename);
        }

        const exts = Array.isArray(query) ? query : [query];
        return exts.some((ext) =>
            filename.toLowerCase().endsWith(ext.toLowerCase())
        );
    };

    return entries.flatMap((entry) => {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            return getAssetFiles(query, fullPath);
        }

        if (entry.isFile() && matches(entry.name)) {
            return [fullPath];
        }

        return [];
    });
}

// TODO: add function to delete all compressed assets