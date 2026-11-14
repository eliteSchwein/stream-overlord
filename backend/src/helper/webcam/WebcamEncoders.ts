import {execFile} from "node:child_process";
import * as dgram from "node:dgram";
import * as fs from "node:fs";
import * as path from "node:path";
import {promisify} from "node:util";
import {logNotice, logRegular} from "../LogHelper";

const execFileAsync = promisify(execFile);

export type VideoCodec = "h264" | "h265" | "av1";

// Encoder family; together with the codec it selects the ffmpeg encoder.
export type EncoderKind = "nvenc" | "vaapi" | "rkmpp" | "v4l2m2m" | "software";

export type VideoEncoder = {
    kind: EncoderKind;
    codec: VideoCodec;
    // e.g. /dev/dri/renderD128 for vaapi
    device?: string;
    // Extra environment for ffmpeg (LIBVA_DRIVER_NAME for vaapi).
    env?: Record<string, string>;
    label: string;
};

export type EncodeSettings = {
    width: number;
    height: number;
    fps: number;
    bitrateKbps: number;
};

const FFMPEG_ENCODERS: Record<EncoderKind, Partial<Record<VideoCodec, string>>> = {
    nvenc: {h264: "h264_nvenc", h265: "hevc_nvenc", av1: "av1_nvenc"},
    vaapi: {h264: "h264_vaapi", h265: "hevc_vaapi", av1: "av1_vaapi"},
    rkmpp: {h264: "h264_rkmpp", h265: "hevc_rkmpp"},
    v4l2m2m: {h264: "h264_v4l2m2m", h265: "hevc_v4l2m2m"},
    // No software AV1: far too slow for live encoding on the target devices.
    software: {h264: "libx264", h265: "libx265"},
};

const CODEC_LABELS: Record<VideoCodec, string> = {h264: "H.264", h265: "H.265", av1: "AV1"};

/**
 * ffmpeg arguments for an encoder: `global` goes before the inputs, `filter`
 * is the video filter chain (pixel format / hw upload), `codec` the output
 * options. The same builder is used for the probe and the real stream, so a
 * probe failure also catches unsupported options in that ffmpeg build.
 *
 * No encoder produces B-frames: WebRTC playback does not support them.
 * H.264 uses constrained baseline where the encoder supports profiles, which
 * every WebRTC browser can decode.
 */
export function buildEncoderArgs(encoder: VideoEncoder, settings: EncodeSettings) {
    const bitrate = `${settings.bitrateKbps}k`;
    const gop = String(Math.max(1, Math.round(settings.fps * 2)));
    const codec = FFMPEG_ENCODERS[encoder.kind][encoder.codec];
    if (!codec) throw new Error(`${encoder.kind} cannot encode ${encoder.codec}`);

    switch (encoder.kind) {
        case "nvenc":
            return {
                global: [] as string[],
                filter: "format=yuv420p",
                codec: [
                    "-c:v", codec, "-preset", "p4", "-tune", "ll",
                    ...(encoder.codec === "h264" ? ["-profile:v", "baseline"] : []),
                    ...(encoder.codec === "h265" ? ["-profile:v", "main"] : []),
                    "-rc", "cbr", "-b:v", bitrate, "-maxrate", bitrate, "-bufsize", bitrate,
                    "-g", gop, "-bf", "0",
                ],
            };
        case "vaapi":
            return {
                global: ["-vaapi_device", encoder.device ?? "/dev/dri/renderD128"],
                filter: "format=nv12,hwupload",
                codec: [
                    "-c:v", codec,
                    ...(encoder.codec === "h264" ? ["-profile:v", "constrained_baseline"] : []),
                    ...(encoder.codec === "h265" ? ["-profile:v", "main"] : []),
                    "-rc_mode", "CBR", "-b:v", bitrate, "-maxrate", bitrate,
                    "-g", gop, "-bf", "0",
                ],
            };
        case "rkmpp":
            return {
                global: [] as string[],
                filter: "format=nv12",
                codec: ["-c:v", codec, "-rc_mode", "CBR", "-b:v", bitrate, "-g", gop],
            };
        case "v4l2m2m":
            return {
                global: [] as string[],
                filter: "format=yuv420p",
                codec: ["-c:v", codec, "-b:v", bitrate, "-g", gop],
            };
        case "software":
            return {
                global: [] as string[],
                filter: "format=yuv420p",
                codec: [
                    "-c:v", codec, "-preset", "veryfast", "-tune", "zerolatency",
                    ...(encoder.codec === "h264"
                        ? ["-profile:v", "baseline"]
                        : ["-x265-params", "bframes=0:log-level=error"]),
                    "-b:v", bitrate, "-maxrate", bitrate,
                    "-bufsize", `${settings.bitrateKbps * 2}k`, "-g", gop,
                ],
            };
    }
}

// Kernel DRM driver -> VA-API driver with encode support.
const VA_DRIVERS: Record<string, string> = {
    i915: "iHD",
    xe: "iHD",
    amdgpu: "radeonsi",
};

function getKernelDriver(renderNode: string) {
    try {
        return path.basename(fs.realpathSync(`/sys/class/drm/${renderNode}/device/driver`));
    } catch {
        return "";
    }
}

type Family = Omit<VideoEncoder, "codec" | "label"> & {label: string};

function families(): Family[] {
    const list: Family[] = [{kind: "nvenc", label: "NVIDIA NVENC"}];

    // VAAPI covers Intel and AMD GPUs; try every render node (multi-GPU).
    // The VA driver is chosen per node: a global LIBVA_DRIVER_NAME (e.g.
    // "nvidia" for decode on NVIDIA systems) would otherwise break encoding
    // on the Intel/AMD node.
    try {
        for (const node of fs.readdirSync("/dev/dri").filter((entry) => entry.startsWith("renderD")).sort()) {
            const vaDriver = VA_DRIVERS[getKernelDriver(node)];
            if (!vaDriver) continue;
            list.push({
                kind: "vaapi",
                device: `/dev/dri/${node}`,
                env: {LIBVA_DRIVER_NAME: vaDriver},
                label: `VA-API (${node}, ${vaDriver})`,
            });
        }
    } catch {
        // no DRM devices
    }

    list.push(
        {kind: "rkmpp", label: "Rockchip MPP"},
        // Raspberry Pi 4 (the Pi 5 has no hardware encoder).
        {kind: "v4l2m2m", label: "V4L2 M2M (Raspberry Pi)"},
        {kind: "software", label: "Software"},
    );

    return list;
}

function candidates(): VideoEncoder[] {
    const list: VideoEncoder[] = [];
    for (const codec of ["h264", "h265", "av1"] as VideoCodec[]) {
        for (const family of families()) {
            if (!FFMPEG_ENCODERS[family.kind][codec]) continue;
            const software = family.kind === "software";
            list.push({
                ...family,
                codec,
                label: `${CODEC_LABELS[codec]} · ${software ? (codec === "h264" ? "x264" : "x265") : family.label}`,
            });
        }
    }
    return list;
}

/** A UDP sink on localhost for probing the RTP packetizer. */
function withUdpSink<T>(run: (port: number) => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        const socket = dgram.createSocket("udp4");
        socket.on("error", reject);
        socket.on("message", () => undefined);
        socket.bind(0, "127.0.0.1", () => {
            const {port} = socket.address();
            run(port).then(resolve, reject).finally(() => socket.close());
        });
    });
}

async function probe(ffmpeg: string, encoder: VideoEncoder) {
    const settings = {width: 1280, height: 720, fps: 30, bitrateKbps: 2500};
    const args = buildEncoderArgs(encoder, settings);
    const input = [
        "-hide_banner", "-loglevel", "error",
        ...args.global,
        "-f", "lavfi", "-i", `testsrc2=size=${settings.width}x${settings.height}:rate=${settings.fps}`,
        "-frames:v", "10",
        "-vf", args.filter,
        ...args.codec,
    ];
    const options = {timeout: 20_000, env: {...process.env, ...encoder.env}};

    try {
        if (encoder.codec === "av1") {
            // AV1 is published over RTSP; older ffmpeg builds have no AV1 RTP
            // packetizer, so probe that path too.
            await withUdpSink((port) => execFileAsync(ffmpeg, [
                ...input, "-strict", "experimental", "-f", "rtp", `rtp://127.0.0.1:${port}`,
            ], options));
        } else {
            await execFileAsync(ffmpeg, [...input, "-f", "null", "-"], options);
        }
        return true;
    } catch {
        return false;
    }
}

let probePromise: Promise<VideoEncoder[]> | null = null;

/**
 * Encoders that actually work on this machine, per codec, best first (the
 * software encoder last). Cached for the process lifetime.
 */
export function getAvailableEncoders(ffmpeg: string, refresh = false) {
    if (!probePromise || refresh) {
        probePromise = (async () => {
            const available: VideoEncoder[] = [];
            for (const encoder of candidates()) {
                if (await probe(ffmpeg, encoder)) {
                    available.push(encoder);
                    logRegular(`webcam encoder available: ${encoder.label}`);
                }
            }
            if (!available.some((encoder) => encoder.codec === "h264")) {
                logNotice("no working H.264 encoder found in ffmpeg");
            }
            return available;
        })();
    }

    return probePromise;
}
