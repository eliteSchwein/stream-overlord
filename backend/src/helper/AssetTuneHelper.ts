import {getConfig} from "./ConfigHelper";
import * as path from "node:path";
import * as fs from "node:fs";
import {unlinkSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {getGpu} from "./SystemInfoHelper";
import {isDebug, logError, logNotice, logRegular, logWarn} from "./LogHelper";

type FfmpegInit = {
    ffmpegBin: string;
    filterOptions: string;
    hwAccel: string;
    vaapiDevice: string;
};

export async function compressAssets(force: boolean = false) {
    const assetDirectory = path.resolve(__dirname, "../../assets");

    const videoAssets = getAssetFiles(".mp4", assetDirectory);

    const { ffmpegBin, hwAccel, filterOptions } = await initFfmpeg(); // now async

    if(force) {
        logWarn("Force compressing assets")
    }
    logRegular(`Compressing ${videoAssets.length} video assets...`)

    for(const videoAsset of videoAssets) {
        const targetVideoAsset = videoAsset.replace(/\.mp4$/i, ".webm")

        if(fs.existsSync(targetVideoAsset) && !force) continue
        if(fs.existsSync(targetVideoAsset) && force) {
            unlinkSync(targetVideoAsset)
        }

        logNotice(`Compressing ${videoAsset} to ${targetVideoAsset}`)

        const args = [
         ...splitArgs(hwAccel),
         "-i", videoAsset,
         ...splitArgs(filterOptions),
         targetVideoAsset,
        ].filter(Boolean)
        try {
            execFileSync(ffmpegBin, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
        } catch (error: any) {
            if(isDebug()) {
                logError(`Compressing ${videoAsset} failed:`)
                logError(error.stderr?.toString())
                continue
            }

            logError(`Compressing ${videoAsset} failed`)
        }

    }
}

async function initFfmpeg(): Promise<FfmpegInit> {
    const config = getConfig(/asset_tune/g)[0];
    const ffmpegBin = ((config?.ffmpeg?.bin as string) || process.env.FFMPEG_BIN || "ffmpeg").trim();
    const forceCodec = ((config?.codec as string) || process.env.VIDEO_PROCCESSING_CODEC || "vp9")
        .trim()
        .toLowerCase();

    const runAndCapture = (args: string[]) => {
        try {
            return execFileSync(ffmpegBin, args, { encoding: "utf8" });
        } catch (e: any) {
            return (e?.stdout?.toString?.() || e?.stderr?.toString?.() || "") as string;
        }
    };

    const isReadable = (p: string) => {
        try { fs.accessSync(p, fs.constants.R_OK); return true; } catch { return false; }
    };

    const gfx = getGpu();
    const controllers = gfx.controllers || [];
    const vendorStr = (v?: string) => (v || "").toLowerCase();

    const hasIntelGPU  = controllers.some(c => /intel/.test(vendorStr(c.vendor)));
    const hasNvidiaGPU = controllers.some(c => /nvidia/.test(vendorStr(c.vendor)));

    const encoders = runAndCapture(["-hide_banner", "-v", "error", "-encoders"]);
    const accels   = runAndCapture(["-hide_banner", "-v", "error", "-hwaccels"]);

    const haveNvenc = /\bav1_nvenc\b/.test(encoders);
    const haveQsv   = /\bav1_qsv\b/.test(encoders);
    const haveVaapi = /\bav1_vaapi\b/.test(encoders);
    const haveSVT   = /\blibsvtav1\b/.test(encoders);
    const haveAOM   = /\blibaom-av1\b/.test(encoders);

    const vaapiDevice = (process.env.VAAPI_DEVICE || "/dev/dri/renderD128").trim();
    const vaapiDeviceOk = isReadable(vaapiDevice);

    const nvencAllowed = !config?.disable_nv && haveNvenc && hasNvidiaGPU;
    const qsvAllowed   = !config?.disable_qsv && haveQsv && hasIntelGPU && vaapiDeviceOk;
    const vaapiDisabled = (config as any)?.disable_vaapi ?? (config as any)?.disable_vaapi;
    const vaapiAllowed = !vaapiDisabled && haveVaapi && vaapiDeviceOk;

    let filterOptions: string;
    let hwAccel = "";

    if (forceCodec === "av1") {
        if (nvencAllowed) {
            filterOptions = "-c:v av1_nvenc -preset p5 -b:v 5M -maxrate 5M -c:a libopus -b:a 128k";
            hwAccel = /\bcuda\b/i.test(accels) ? "-hwaccel cuda" : "";
        } else if (qsvAllowed) {
            filterOptions = "-c:v av1_qsv -preset medium -b:v 5M -maxrate 5M -c:a libopus -b:a 128k";
            hwAccel = /\bqsv\b/i.test(accels) ? "-hwaccel qsv" : "";
        } else if (vaapiAllowed) {
            hwAccel = `-hwaccel vaapi -vaapi_device ${shellArg(vaapiDevice)}`;
            filterOptions = "-vf 'format=nv12,hwupload' -c:v av1_vaapi -b:v 5M -maxrate 5M -c:a libopus -b:a 128k";
        } else if (haveSVT) {
            filterOptions = "-c:v libsvtav1 -preset 6 -crf 30 -b:v 0 -c:a libopus -b:a 128k";
        } else if (haveAOM) {
            filterOptions = "-c:v libaom-av1 -crf 30 -b:v 0 -c:a libopus -b:a 128k";
        } else {
            filterOptions = "-c:v libvpx-vp9 -crf 30 -b:v 0 -c:a libopus -b:a 128k";
        }
    } else {
        filterOptions = "-c:v libvpx-vp9 -crf 30 -b:v 0 -c:a libopus -b:a 128k";
    }

    return { ffmpegBin, filterOptions, hwAccel, vaapiDevice };

    function shellArg(s: string) {
        if (process.platform === "win32") return `"${s.replace(/"/g, '\\"')}"`;
        return `'${String(s).replace(/'/g, `'\\''`)}'`;
    }
}

function splitArgs(s: string): string[] {
    return s
        ? s.match(/'[^']*'|"[^"]*"|\S+/g)?.map((t) => t.replace(/^['"]|['"]$/g, "")) || []
        : [];
}

function getAssetFiles(
    extension: string,
    dir: string = path.resolve(__dirname, "../../assets")
): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries.flatMap((entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            return getAssetFiles(extension, fullPath);
        } else if (entry.isFile() && entry.name.endsWith(extension)) {
            return [fullPath];
        }
        return [];
    });
}
