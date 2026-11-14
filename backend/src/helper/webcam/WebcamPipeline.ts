import {buildEncoderArgs, VideoEncoder} from "./WebcamEncoders";

export type PipelineOptions = {
    ffmpeg: string;
    // ffmpeg input arguments for the camera (v4l2 in production).
    cameraInput: string[];
    width: number;
    height: number;
    fps: number;
    bitrateKbps: number;
    // PulseAudio source, "" = no audio
    audioSource: string;
    encoder: VideoEncoder;
    // SRT publish URL (MPEG-TS), used for H.264/H.265.
    publishUrl: string;
    // RTSP publish URL, used for AV1 (MediaMTX cannot take AV1 in MPEG-TS).
    publishRtspUrl: string;
};

export function buildCameraInput(devicePath: string, inputFormat: string, size: string, fps: number) {
    return [
        "-f", "v4l2", "-thread_queue_size", "512",
        "-input_format", inputFormat,
        "-video_size", size,
        "-framerate", String(fps),
        "-i", devicePath,
    ];
}

function audioArgs(source: string) {
    return {
        input: source ? ["-f", "pulse", "-thread_queue_size", "512", "-i", source] : [],
        output: source
            ? ["-map", "1:a:0", "-c:a", "libopus", "-b:a", "96k", "-ac", "2", "-ar", "48000", "-af", "aresample=async=1"]
            : [],
    };
}

function outputArgs(options: PipelineOptions) {
    if (options.encoder.codec === "av1") {
        // ffmpeg's AV1 RTP packetizer is still flagged experimental.
        return ["-strict", "experimental", "-f", "rtsp", "-rtsp_transport", "tcp", options.publishRtspUrl];
    }
    // MPEG-TS over SRT; headers are repeated so late readers can start.
    return ["-f", "mpegts", "-mpegts_flags", "+resend_headers", options.publishUrl];
}

/** One ffmpeg process: camera -> encoder -> SRT. */
export function buildDirectCommand(options: PipelineOptions) {
    const encoder = buildEncoderArgs(options.encoder, options);
    const audio = audioArgs(options.audioSource);

    return [
        options.ffmpeg,
        "-hide_banner", "-loglevel", "warning",
        ...encoder.global,
        ...options.cameraInput,
        ...audio.input,
        "-map", "0:v:0",
        "-vf", `scale=${options.width}:${options.height},${encoder.filter}`,
        ...encoder.codec,
        ...audio.output,
        ...outputArgs(options),
    ];
}

/**
 * Two ffmpeg processes for the blur worker: camera -> raw BGR frames, and
 * raw BGR frames (stdin) -> encoder -> SRT.
 */
export function buildBlurCommands(options: PipelineOptions) {
    const encoder = buildEncoderArgs(options.encoder, options);
    const audio = audioArgs(options.audioSource);

    return {
        capture: [
            options.ffmpeg,
            "-hide_banner", "-loglevel", "warning",
            ...options.cameraInput,
            "-vf", `scale=${options.width}:${options.height}`,
            // Hand frames on as the camera delivers them. Cameras drop below
            // their nominal rate in low light; constant-rate output would
            // duplicate frames that the detector and encoder then process.
            "-fps_mode", "passthrough",
            "-f", "rawvideo", "-pix_fmt", "bgr24", "-",
        ],
        encode: [
            options.ffmpeg,
            "-hide_banner", "-loglevel", "warning",
            ...encoder.global,
            "-use_wallclock_as_timestamps", "1",
            "-f", "rawvideo", "-pix_fmt", "bgr24",
            "-video_size", `${options.width}x${options.height}`,
            "-framerate", String(options.fps),
            "-i", "pipe:0",
            ...audio.input,
            "-map", "0:v:0",
            "-vf", encoder.filter,
            ...encoder.codec,
            ...audio.output,
            ...outputArgs(options),
        ],
    };
}
