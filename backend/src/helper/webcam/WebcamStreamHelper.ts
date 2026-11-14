/**
 * Streams USB webcams (each optionally with a microphone) to the cloud.
 *
 * Every configured camera is its own stream: the cloud
 * (streambot-remote-backend) hands out a stream key per bot instance and
 * camera plus an SRT publish URL for its MediaMTX relay
 * ("webcam_stream_credentials"). The viewer URL of a camera never changes and
 * only works while that camera publishes. Video is H.264 from the best
 * working hardware encoder (NVENC, VA-API for Intel/AMD, Rockchip MPP,
 * Raspberry Pi 4 V4L2 M2M) with x264 as fallback, audio is Opus, muxed as
 * MPEG-TS over SRT.
 *
 * Cameras are addressed by their stable udev path (/dev/v4l/by-id, or
 * by-path for cameras without a unique serial), so they keep their settings
 * when /dev/videoN numbers change. /dev is watched for hotplug.
 *
 * With face/license plate blur enabled a camera runs through
 * scripts/webcam/blur_worker.py on the accelerator chosen per camera (Coral
 * Edge TPU, Rockchip NPU or CPU). An Edge TPU can only be opened by one
 * process, so at most one camera gets the Coral. If blur is requested but
 * unavailable the camera does not stream at all: nothing is sent unblurred.
 */
import {ChildProcess, spawn} from "node:child_process";
import {randomBytes} from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type {WebSocket} from "ws";
import getWebsocketServer, {getCloudClient} from "../../App";
import {getAssetTuneSettings} from "../ConfigHelper";
import {readIntegrations, writeIntegrations} from "../IntegrationsHelper";
import {logNotice, logRegular, logSuccess, logWarn} from "../LogHelper";
import {runStreaming} from "../UpdateProgress";
import {
    AudioSource,
    detectAccelerators,
    listAudioSources,
    listWebcams,
    WebcamAccelerators,
    WebcamDevice,
} from "./WebcamDevices";
import {EncoderKind, getAvailableEncoders, VideoCodec, VideoEncoder} from "./WebcamEncoders";
import {HardwareChange, HardwareMonitor} from "./WebcamHotplug";
import {buildBlurCommands, buildCameraInput, buildDirectCommand, PipelineOptions} from "./WebcamPipeline";

// "coral" = any free Coral, "coral:usb:1" / "coral:pci:0" = that one.
export type WebcamAcceleratorSetting = string;
// What the blur worker runs on: faces on a Coral ("coral:usb:0"), the GPU,
// the Rockchip NPU or the CPU; plates (onnxruntime) on the GPU or the CPU.
export type EffectiveAccelerator = {
    face: string;
    plate: "gpu" | "cpu";
};
const ACCELERATOR_SETTING = /^(auto|cpu|gpu|rknn|coral(:(usb|pci):\d+)?)$/;
export type PlateAcceleratorSetting = "auto" | "gpu" | "cpu";

export type WebcamCameraSettings = {
    // Stable id, also the camera id in the cloud (keeps the viewer URL).
    id: string;
    name: string;
    enabled: boolean;
    // Stable device path (/dev/v4l/by-id/..., /dev/v4l/by-path/...).
    device: string;
    width: number;
    height: number;
    fps: number;
    bitrate_kbps: number;
    // PulseAudio source name, "" = no audio
    audio_source: string;
    blur_faces: boolean;
    blur_plates: boolean;
    show_detections: boolean;
    // Detection hardware per filter: faces can use a Coral, the GPU, the
    // Rockchip NPU or the CPU; plates (no Coral/NPU model) the GPU or the CPU.
    face_accelerator: WebcamAcceleratorSetting;
    plate_accelerator: PlateAcceleratorSetting;
    codec: VideoCodec;
    // "auto" or an encoder family for `codec`.
    encoder: "auto" | EncoderKind;
};

export type WebcamIntegration = {
    cameras: WebcamCameraSettings[];
};

export type WebcamStreamState =
    | "disabled"
    | "waiting_for_cloud"
    | "waiting_for_device"
    | "requesting"
    | "starting"
    | "streaming"
    | "error";

type Credentials = {
    stream_key: string;
    publish_url: string;
    viewer_url: string;
    // Read-only RTSP URL (empty with older cloud backends).
    rtsp_url: string;
    // RTSP publish URL for AV1 (empty with older cloud backends).
    publish_rtsp_url: string;
};

const CAMERA_DEFAULTS: Omit<WebcamCameraSettings, "id" | "name" | "device"> = {
    enabled: false,
    width: 1280,
    height: 720,
    fps: 30,
    bitrate_kbps: 2500,
    audio_source: "",
    blur_faces: false,
    blur_plates: false,
    show_detections: false,
    face_accelerator: "auto",
    plate_accelerator: "auto",
    codec: "h264",
    encoder: "auto",
};

const RESTART_DELAYS_MS = [2_000, 5_000, 10_000, 30_000];
// A pipeline that ran this long resets the restart backoff.
const STABLE_RUN_MS = 60_000;
const CREDENTIALS_TIMEOUT_MS = 15_000;
// One plug-in produces a burst of udev events (USB device, interfaces,
// video nodes); udev has created the by-id/by-path links when they arrive.
const HOTPLUG_DEBOUNCE_MS = 700;
// Harmless messages printed on every start (MJPEG full-range input, Pulse
// layout guess, OpenCV DNN backend notice).
const IGNORED_OUTPUT = /deprecated pixel format used|Guessed Channel Layout|setPreferableTarget/;

class CameraStream {
    credentials: Credentials | null = null;
    requested = false;
    credentialsTimer: NodeJS.Timeout | null = null;
    pipeline: ChildProcess | null = null;
    // Resolves when the last stopped process exited (it may still hold the
    // camera device for a moment).
    exited: Promise<void> = Promise.resolve();
    // Bumped on every start/stop; a delayed start checks it is still current.
    generation = 0;
    // Settings + effective accelerator the running pipeline was started with.
    pipelineSignature = "";
    stopping = false;
    restartTimer: NodeJS.Timeout | null = null;
    restartAttempt = 0;
    startedAt = 0;

    state: WebcamStreamState = "disabled";
    error = "";
    encoder = "";
    accelerator: EffectiveAccelerator = {face: "cpu", plate: "cpu"};
    // Live info from the blur worker: detectors in use, fps, detection fps.
    worker: Record<string, any> = {};

    constructor(readonly id: string) {}
}

const streams = new Map<string, CameraStream>();

const runtime = {
    cloud_open: false,
    devices: [] as WebcamDevice[],
    audio_sources: [] as AudioSource[],
    encoders: [] as VideoEncoder[],
    accelerators: {corals: [], gpu: {vendor: null, runtime: null}, rockchip_npu: null} as WebcamAccelerators,
    blur_install: null as {stage: string} | null,
    blur_install_error: "",
};

let installPromise: Promise<void> | null = null;
let hardwareMonitor: HardwareMonitor | null = null;
const hotplugTimers: Partial<Record<HardwareChange, NodeJS.Timeout>> = {};
let deviceRefresh: Promise<void> | null = null;
let deviceRefreshPending = false;

// ---------------------------------------------------------------------------
// Paths and settings
// ---------------------------------------------------------------------------

function getBlurRoot() {
    return path.join(os.homedir(), ".local", "share", "streambot", "webcam");
}

/** Install dir of the privacy blur (storage overview). */
export function getWebcamBlurRoot() {
    return getBlurRoot();
}

async function emitStorageUpdate() {
    try {
        const {emitSystemStorageUpdate} = await import("../SystemStorageHelper");
        emitSystemStorageUpdate();
    } catch (error: any) {
        logWarn(`storage update failed: ${error?.message ?? error}`);
    }
}

function getBlurPython() {
    return path.join(getBlurRoot(), "venv", "bin", "python");
}

function isBlurInstalled() {
    return fs.existsSync(path.join(getBlurRoot(), ".installed")) && fs.existsSync(getBlurPython());
}

/** Installed before the better plate model existed: re-run the installer. */
function isBlurUpdateAvailable() {
    return isBlurInstalled() && !fs.existsSync(path.join(getBlurRoot(), "models", "plate_640.onnx"));
}

function getScript(relative: string) {
    const candidates = [
        path.resolve(__dirname, "../../scripts", relative),
        path.resolve(process.cwd(), "scripts", relative),
    ];
    const script = candidates.find((candidate) => fs.existsSync(candidate));
    if (!script) throw new Error(`scripts/${relative} not found`);
    return script;
}

function getScriptOrEmpty(relative: string) {
    try {
        return getScript(relative);
    } catch {
        return `scripts/${relative}`;
    }
}

function getFfmpeg() {
    return getAssetTuneSettings()?.ffmpeg_bin || "ffmpeg";
}

function newCameraId() {
    return randomBytes(6).toString("hex");
}

export function getWebcamIntegration(): WebcamIntegration {
    const raw = (readIntegrations() as any).webcam;
    const cameras = Array.isArray(raw?.cameras) ? raw.cameras : [];
    return {
        cameras: cameras.map((camera: any) => {
            const {accelerator: legacyAccelerator, ...rest} = camera ?? {};
            return {
                ...CAMERA_DEFAULTS,
                // One shared "accelerator" setting before per-filter hardware.
                ...(legacyAccelerator !== undefined ? {
                    face_accelerator: String(legacyAccelerator),
                    plate_accelerator: legacyAccelerator === "cpu" ? "cpu" : "auto",
                } : {}),
                ...rest,
                encoder: camera?.encoder === "x264" ? "software" : camera?.encoder ?? CAMERA_DEFAULTS.encoder,
            };
        }),
    };
}

function writeWebcamIntegration(config: WebcamIntegration) {
    const integrations = readIntegrations() as any;
    integrations.webcam = config;
    writeIntegrations(integrations);
}

/**
 * The first version stored one camera directly in integrations.webcam with a
 * /dev/videoN device. Converts it into the camera list.
 */
function migrateLegacyConfig() {
    const raw = (readIntegrations() as any).webcam;
    if (!raw || Array.isArray(raw.cameras) || !("enabled" in raw || "device" in raw)) return;

    const legacyDevice = String(raw.device ?? "");
    const device = runtime.devices.find((entry) => entry.node === legacyDevice || entry.path === legacyDevice)
        ?? (legacyDevice ? undefined : runtime.devices[0]);

    const {device: _ignored, ...settings} = raw;
    writeWebcamIntegration({
        cameras: [{
            ...CAMERA_DEFAULTS,
            ...settings,
            id: newCameraId(),
            name: device?.name ?? "Webcam",
            device: device?.path ?? legacyDevice,
        }],
    });
    logNotice("webcam settings migrated to the multi camera format");
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
    const number = Math.round(Number(value));
    return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function normalizeCamera(input: Partial<WebcamCameraSettings>, current: WebcamCameraSettings): WebcamCameraSettings {
    const next = {...current};

    if (input.name !== undefined) next.name = String(input.name ?? "").trim().slice(0, 64) || current.name;
    if (input.enabled !== undefined) next.enabled = Boolean(input.enabled);
    if (input.device !== undefined) next.device = String(input.device ?? "");
    if (input.width !== undefined) next.width = clampInt(input.width, 160, 3840, current.width) & ~1;
    if (input.height !== undefined) next.height = clampInt(input.height, 120, 2160, current.height) & ~1;
    if (input.fps !== undefined) next.fps = clampInt(input.fps, 5, 60, current.fps);
    if (input.bitrate_kbps !== undefined) next.bitrate_kbps = clampInt(input.bitrate_kbps, 300, 20_000, current.bitrate_kbps);
    if (input.audio_source !== undefined) next.audio_source = String(input.audio_source ?? "");
    if (input.blur_faces !== undefined) next.blur_faces = Boolean(input.blur_faces);
    if (input.blur_plates !== undefined) next.blur_plates = Boolean(input.blur_plates);
    if (input.show_detections !== undefined) next.show_detections = Boolean(input.show_detections);
    if (input.face_accelerator !== undefined) {
        const accelerator = String(input.face_accelerator ?? "");
        next.face_accelerator = ACCELERATOR_SETTING.test(accelerator) ? accelerator : "auto";
    }
    if (input.plate_accelerator !== undefined) {
        next.plate_accelerator = (["auto", "gpu", "cpu"] as const).includes(input.plate_accelerator as any)
            ? input.plate_accelerator as PlateAcceleratorSetting
            : "auto";
    }
    if (input.codec !== undefined) {
        next.codec = (["h264", "h265", "av1"] as const).includes(input.codec as any) ? input.codec as VideoCodec : "h264";
    }
    if (input.encoder !== undefined) {
        // "x264" was the software encoder before codecs were selectable.
        const encoder = (input.encoder as string) === "x264" ? "software" : input.encoder;
        next.encoder = (["auto", "nvenc", "vaapi", "rkmpp", "v4l2m2m", "software"] as const).includes(encoder as any)
            ? encoder as WebcamCameraSettings["encoder"]
            : "auto";
    }

    return next;
}

// ---------------------------------------------------------------------------
// Accelerator assignment
// ---------------------------------------------------------------------------

/**
 * Effective detection hardware per camera and filter.
 *
 * Faces: an Edge TPU can only be opened by one process, so each Coral serves
 * one camera. Cameras pinned to a specific Coral get it first, then cameras
 * asking for any Coral, then cameras on "auto" (free Coral, else GPU, else
 * Rockchip NPU, else CPU). Only cameras that blur faces take a Coral.
 *
 * Plates: GPU or CPU ("auto" = GPU when a GPU runtime is installed). An
 * explicit "gpu" is passed on even without a runtime, so the worker reports
 * why it fell back to the CPU.
 */
function assignAccelerators(cameras: WebcamCameraSettings[]) {
    const result = new Map<string, EffectiveAccelerator>();
    const corals = runtime.accelerators.corals.map((coral) => coral.id);
    const gpu = Boolean(runtime.accelerators.gpu.runtime);
    const npu = Boolean(runtime.accelerators.rockchip_npu);
    const faceBlurring = cameras.filter((camera) => camera.enabled && (camera.blur_faces || camera.show_detections));
    const taken = new Set<string>();
    const face = new Map<string, string>();

    const claim = (camera: WebcamCameraSettings, coral: string | undefined) => {
        if (!coral || taken.has(coral) || !corals.includes(coral)) return false;
        taken.add(coral);
        face.set(camera.id, `coral:${coral}`);
        return true;
    };

    for (const camera of faceBlurring) {
        if (camera.face_accelerator.startsWith("coral:")) claim(camera, camera.face_accelerator.slice("coral:".length));
    }
    for (const camera of faceBlurring) {
        if (camera.face_accelerator === "coral" && !face.has(camera.id)) {
            claim(camera, corals.find((coral) => !taken.has(coral)));
        }
    }
    for (const camera of faceBlurring) {
        if (camera.face_accelerator === "auto" && !face.has(camera.id)) {
            if (!claim(camera, corals.find((coral) => !taken.has(coral)))) {
                face.set(camera.id, gpu ? "gpu" : npu ? "rknn" : "cpu");
            }
        }
    }

    for (const camera of cameras) {
        let faceAccelerator = face.get(camera.id);
        if (!faceAccelerator) {
            // Explicit gpu/rknn/cpu, or a Coral request that could not be met.
            const setting = camera.face_accelerator;
            if (setting === "gpu") faceAccelerator = "gpu";
            else if (setting === "rknn") faceAccelerator = "rknn";
            else if (setting.startsWith("coral") || setting === "auto") faceAccelerator = gpu ? "gpu" : npu ? "rknn" : "cpu";
            else faceAccelerator = "cpu";
        }

        const plate: EffectiveAccelerator["plate"] =
            camera.plate_accelerator === "gpu" || (camera.plate_accelerator === "auto" && gpu) ? "gpu" : "cpu";

        result.set(camera.id, {face: faceAccelerator, plate});
    }

    return result;
}

// ---------------------------------------------------------------------------
// State for the admin frontend
// ---------------------------------------------------------------------------

function findDevice(devicePath: string) {
    return runtime.devices.find((device) => device.path === devicePath || device.node === devicePath);
}

export function getWebcamUpdate() {
    const config = getWebcamIntegration();

    return {
        cloud_connected: runtime.cloud_open,
        cameras: config.cameras.map((camera) => {
            const stream = streams.get(camera.id);
            return {
                ...camera,
                state: stream?.state ?? (camera.enabled ? "waiting_for_cloud" : "disabled"),
                error: stream?.error ?? "",
                viewer_url: stream?.credentials?.viewer_url ?? "",
                rtsp_url: stream?.credentials?.rtsp_url ?? "",
                // Label of the encoder the running pipeline uses; `encoder` stays
                // the saved setting ("auto" or a kind).
                encoder_in_use: stream?.encoder ?? "",
                accelerator_in_use: stream?.pipeline ? stream.accelerator : null,
                worker: stream?.worker ?? {},
                device_present: Boolean(findDevice(camera.device)),
            };
        }),
        devices: runtime.devices,
        audio_sources: runtime.audio_sources,
        encoders: runtime.encoders.map((encoder) => ({kind: encoder.kind, codec: encoder.codec, label: encoder.label})),
        accelerators: runtime.accelerators,
        blur_installed: isBlurInstalled(),
        blur_update_available: isBlurUpdateAvailable(),
        blur_install: runtime.blur_install,
        blur_install_error: runtime.blur_install_error,
        // udev rule written by the blur installer, for the Coral access hint.
        // One-time root command when a Coral is connected but not accessible.
        coral_udev_command: runtime.accelerators.corals.some((coral) => !coral.accessible)
            ? `sudo bash ${getScriptOrEmpty("install_coral_udev.sh")} ${os.userInfo().username}`
            : "",
    };
}

export function emitWebcamUpdate(connection?: WebSocket) {
    getWebsocketServer()?.send("notify_webcam_update", getWebcamUpdate(), connection);
}

function setState(stream: CameraStream, state: WebcamStreamState, error = "") {
    if (stream.state === state && stream.error === error) return;
    stream.state = state;
    stream.error = error;
    emitWebcamUpdate();
}

async function refreshDevices() {
    const [devices, audioSources] = await Promise.all([listWebcams(), listAudioSources()]);
    runtime.devices = devices;
    runtime.audio_sources = audioSources;
    runtime.accelerators = detectAccelerators(getBlurRoot());
}


// ---------------------------------------------------------------------------
// Reconciliation: configured cameras -> cloud sessions and pipelines
// ---------------------------------------------------------------------------

function cameraSignature(camera: WebcamCameraSettings, accelerator: EffectiveAccelerator) {
    const {name: _name, ...relevant} = camera;
    return JSON.stringify({...relevant, accelerator});
}

function sendCloud(payload: any) {
    return Boolean(getCloudClient()?.sendRaw(payload));
}

function clearCredentials(stream: CameraStream, notifyCloud: boolean) {
    if (stream.credentialsTimer) {
        clearTimeout(stream.credentialsTimer);
        stream.credentialsTimer = null;
    }
    if (notifyCloud && (stream.credentials || stream.requested) && runtime.cloud_open) {
        sendCloud({type: "webcam_stream_stop", camera_id: stream.id});
    }
    stream.credentials = null;
    stream.requested = false;
}

function requestCredentials(stream: CameraStream, camera: WebcamCameraSettings) {
    if (stream.requested) return;

    if (!sendCloud({type: "webcam_stream_start", camera_id: camera.id, name: camera.name})) {
        setState(stream, "waiting_for_cloud");
        return;
    }

    stream.requested = true;
    setState(stream, "requesting");
    stream.credentialsTimer = setTimeout(() => {
        stream.credentialsTimer = null;
        if (!stream.credentials && stream.requested) {
            stream.requested = false;
            setState(stream, "error", "the cloud did not answer the stream request (cloud backend too old?)");
        }
    }, CREDENTIALS_TIMEOUT_MS);
}

/**
 * Brings every camera to the state its settings, the cloud connection and
 * the connected devices allow. Called after every change.
 */
function syncStreams() {
    const config = getWebcamIntegration();
    const accelerators = assignAccelerators(config.cameras);
    const configured = new Set(config.cameras.map((camera) => camera.id));

    for (const [id, stream] of streams) {
        if (configured.has(id)) continue;
        stopPipeline(stream, "camera removed");
        clearCredentials(stream, true);
        streams.delete(id);
    }

    for (const camera of config.cameras) {
        let stream = streams.get(camera.id);
        if (!stream) {
            stream = new CameraStream(camera.id);
            streams.set(camera.id, stream);
        }

        const accelerator = accelerators.get(camera.id) ?? {face: "cpu", plate: "cpu" as const};

        if (!camera.enabled) {
            stopPipeline(stream, "disabled");
            clearCredentials(stream, true);
            setState(stream, "disabled");
            continue;
        }

        if (!runtime.cloud_open) {
            // The cloud invalidates publish credentials on disconnect.
            stopPipeline(stream, "cloud disconnected");
            clearCredentials(stream, false);
            setState(stream, "waiting_for_cloud");
            continue;
        }

        if (!findDevice(camera.device)) {
            // Unplugged: end the cloud session so the viewer link goes offline.
            stopPipeline(stream, "camera disconnected");
            clearCredentials(stream, true);
            setState(stream, "waiting_for_device");
            continue;
        }

        if ((camera.blur_faces || camera.blur_plates || camera.show_detections) && !isBlurInstalled()) {
            // Fail closed: never stream unblurred, and do not keep a cloud
            // session open that looks live.
            stopPipeline(stream, "privacy blur not installed");
            clearCredentials(stream, true);
            setState(stream, "error", "privacy blur is enabled but not installed");
            continue;
        }

        if (!stream.credentials) {
            requestCredentials(stream, camera);
            continue;
        }

        const signature = cameraSignature(camera, accelerator);
        if (stream.pipeline && stream.pipelineSignature !== signature) {
            stream.restartAttempt = 0;
            startPipeline(stream, camera, accelerator);
        } else if (!stream.pipeline && !stream.restartTimer && stream.state !== "error") {
            startPipeline(stream, camera, accelerator);
        }
    }

    emitWebcamUpdate();
}

/** Cloud websocket opened/closed (called by CloudClient). */
export function handleWebcamCloudState(open: boolean) {
    runtime.cloud_open = open;
    syncStreams();
}

/** webcam_stream_credentials from the cloud. */
export function handleWebcamCloudMessage(message: any) {
    const stream = streams.get(String(message?.camera_id ?? ""));
    if (!stream) return;

    if (stream.credentialsTimer) {
        clearTimeout(stream.credentialsTimer);
        stream.credentialsTimer = null;
    }

    const publishUrl = String(message?.publish_url ?? "");
    if (!publishUrl.startsWith("srt://")) {
        stream.requested = false;
        setState(stream, "error", "invalid stream credentials from the cloud");
        return;
    }

    stream.credentials = {
        stream_key: String(message?.stream_key ?? ""),
        publish_url: publishUrl,
        viewer_url: String(message?.viewer_url ?? ""),
        rtsp_url: String(message?.rtsp_url ?? ""),
        publish_rtsp_url: String(message?.publish_rtsp_url ?? ""),
    };
    stream.requested = false;
    stream.restartAttempt = 0;
    // A fresh session: retry even after an earlier error.
    stream.state = "starting";
    syncStreams();
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

function chooseCapture(device: WebcamDevice, width: number, height: number, fps: number) {
    const target = `${width}x${height}`;
    const options: Array<{fourcc: string; size: string; fps: number}> = [];

    for (const format of device.formats) {
        if (format.fourcc !== "MJPG" && format.fourcc !== "YUYV") continue;
        for (const [size, maxFps] of Object.entries(format.sizes)) {
            options.push({fourcc: format.fourcc, size, fps: maxFps});
        }
    }

    if (options.length === 0) {
        // Formats unknown (v4l2-ctl missing): let ffmpeg negotiate.
        return {inputFormat: "mjpeg", size: target, fps};
    }

    const pixels = (size: string) => size.split("x").map(Number).reduce((a, b) => a * b, 1);
    const score = (option: {fourcc: string; size: string; fps: number}) => {
        const [w, h] = option.size.split("x").map(Number);
        const big = w >= width && h >= height;
        return [
            option.size === target ? 0 : 1,
            option.fps >= fps ? 0 : 1,
            // Prefer the smallest size that still covers the target.
            big ? pixels(option.size) : Number.MAX_SAFE_INTEGER - pixels(option.size),
            option.fourcc === "MJPG" ? 0 : 1,
        ];
    };

    options.sort((a, b) => {
        const sa = score(a), sb = score(b);
        for (let index = 0; index < sa.length; index++) {
            if (sa[index] !== sb[index]) return sa[index] - sb[index];
        }
        return 0;
    });

    const best = options[0];
    return {
        inputFormat: best.fourcc === "MJPG" ? "mjpeg" : "yuyv422",
        size: best.size,
        fps: Math.min(fps, best.fps || fps),
    };
}

function pickEncoder(setting: WebcamCameraSettings["encoder"], codec: VideoCodec) {
    const forCodec = runtime.encoders.filter((encoder) => encoder.codec === codec);
    if (setting !== "auto") {
        const match = forCodec.find((encoder) => encoder.kind === setting);
        if (match) return match;
        logNotice(`webcam encoder ${setting} cannot encode ${codec} here, using automatic selection`);
    }
    return forCodec[0] ?? null;
}

/** Strips credentials from publish URLs (SRT query, RTSP user:password@). */
function redactUrl(url: string) {
    return url.replace(/\?.*$/, "").replace(/\/\/[^/@]*@/, "//");
}

function startPipeline(stream: CameraStream, camera: WebcamCameraSettings, accelerator: EffectiveAccelerator) {
    stopPipeline(stream, "restart");
    const generation = ++stream.generation;
    stream.pipelineSignature = cameraSignature(camera, accelerator);
    setState(stream, "starting");

    // V4L2 devices can only be opened once: wait until the previous process
    // released the camera.
    void stream.exited.then(() => {
        if (stream.generation !== generation) return;
        spawnPipeline(stream, camera, accelerator);
    });
}

function spawnPipeline(stream: CameraStream, camera: WebcamCameraSettings, accelerator: EffectiveAccelerator) {
    stream.stopping = false;

    if (!stream.credentials) return;

    const blur = camera.blur_faces || camera.blur_plates || camera.show_detections;
    const device = findDevice(camera.device);
    if (!device) {
        setState(stream, "waiting_for_device");
        return;
    }

    const encoder = pickEncoder(camera.encoder, camera.codec);
    if (!encoder) {
        const codec = {h264: "H.264", h265: "H.265", av1: "AV1"}[camera.codec];
        setState(stream, "error", camera.codec === "av1"
            ? "no AV1 hardware encoder available"
            : `ffmpeg has no working ${codec} encoder`);
        return;
    }

    if (encoder.codec === "av1" && !stream.credentials.publish_rtsp_url) {
        setState(stream, "error", "the cloud backend does not support AV1 publishing yet (update it)");
        return;
    }

    if (blur && !isBlurInstalled()) {
        // Fail closed (also checked in syncStreams before the cloud request).
        setState(stream, "error", "privacy blur is enabled but not installed");
        return;
    }

    const capture = chooseCapture(device, camera.width, camera.height, camera.fps);
    const options: PipelineOptions = {
        ffmpeg: getFfmpeg(),
        // The stable udev link, so a renumbered /dev/videoN still works.
        cameraInput: buildCameraInput(camera.device, capture.inputFormat, capture.size, capture.fps),
        width: camera.width,
        height: camera.height,
        fps: capture.fps,
        bitrateKbps: camera.bitrate_kbps,
        audioSource: camera.audio_source,
        encoder,
        publishUrl: stream.credentials.publish_url,
        publishRtspUrl: stream.credentials.publish_rtsp_url,
    };

    let child: ChildProcess;

    if (!blur) {
        const [command, ...args] = buildDirectCommand(options);
        child = spawn(command, args, {stdio: ["ignore", "ignore", "pipe"], env: {...process.env, ...encoder.env}});
    } else {
        const commands = buildBlurCommands(options);
        const runDir = path.join(getBlurRoot(), "run");
        fs.mkdirSync(runDir, {recursive: true, mode: 0o700});
        const configPath = path.join(runDir, `worker-${camera.id}.json`);

        // Holds the publish password: owner-only.
        fs.writeFileSync(configPath, JSON.stringify({
            width: camera.width,
            height: camera.height,
            fps: capture.fps,
            faces: camera.blur_faces || camera.show_detections,
            plates: camera.blur_plates || camera.show_detections,
            show_detections: camera.show_detections,
            blur_faces: camera.blur_faces,
            blur_plates: camera.blur_plates,
            face_accelerator: accelerator.face,
            plate_accelerator: accelerator.plate,
            models_dir: path.join(getBlurRoot(), "models"),
            capture_args: commands.capture,
            encode_args: commands.encode,
        }), {mode: 0o600});

        child = spawn(getBlurPython(), [getScript("webcam/blur_worker.py"), configPath], {
            stdio: ["ignore", "ignore", "pipe"],
            env: {
                ...process.env,
                ...encoder.env,
                LD_LIBRARY_PATH: [path.join(getBlurRoot(), "lib"), process.env.LD_LIBRARY_PATH]
                    .filter(Boolean).join(":"),
            },
        });
    }

    stream.pipeline = child;
    stream.exited = new Promise<void>((resolve) => {
        child.once("close", () => resolve());
        child.once("error", () => resolve());
    });
    stream.startedAt = Date.now();
    stream.encoder = encoder.label;
    stream.accelerator = accelerator;
    stream.worker = {};

    logNotice(
        `webcam ${camera.name}: ${device.name} ${capture.size}@${capture.fps} -> ${camera.width}x${camera.height}, `
        + `${encoder.label}${blur ? `, privacy blur (faces: ${accelerator.face}, plates: ${accelerator.plate})` : ""}`
        + `${camera.audio_source ? ", audio" : ""}`
        + ` -> ${redactUrl(encoder.codec === "av1" ? stream.credentials.publish_rtsp_url : stream.credentials.publish_url)}`,
    );

    let streamingTimer: NodeJS.Timeout | null = blur ? null : setTimeout(() => {
        // ffmpeg prints nothing when everything works; treat a few seconds
        // without exit as streaming.
        if (stream.pipeline === child) setState(stream, "streaming");
    }, 3_000);

    let buffer = "";
    let loggedLines = 0;
    child.stderr?.on("data", (chunk: Buffer) => {
        buffer += chunk.toString("utf8");
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";

        for (const raw of lines) {
            const line = raw.trim();
            if (!line) continue;
            // A stopped pipeline exits with broken pipes etc.; not worth logging.
            if (stream.pipeline !== child) continue;

            if (line.startsWith("STATUS ")) {
                try {
                    const status = JSON.parse(line.slice(7));
                    Object.assign(stream.worker, status);
                    if (status.state === "error") {
                        logWarn(`webcam ${camera.name} blur: ${status.error}`);
                        emitWebcamUpdate();
                    } else if (status.state === "streaming" && stream.state !== "streaming") {
                        setState(stream, "streaming");
                    } else {
                        emitWebcamUpdate();
                    }
                } catch {
                    // malformed status line
                }
                continue;
            }

            if (IGNORED_OUTPUT.test(line)) continue;

            // ffmpeg can repeat warnings every frame; keep the log readable.
            if (loggedLines < 30) {
                loggedLines++;
                logWarn(`webcam ${camera.name}: ${line.replace(/(srt|rtsp):\/\/\S+/g, (url) => redactUrl(url))}`);
            }
        }
    });

    child.once("error", (error) => {
        logWarn(`webcam ${camera.name} pipeline failed to start: ${error.message}`);
    });

    child.once("close", (code, signal) => {
        if (streamingTimer) clearTimeout(streamingTimer);
        streamingTimer = null;
        if (stream.pipeline !== child) return;
        stream.pipeline = null;

        if (stream.stopping) return;

        if (Date.now() - stream.startedAt >= STABLE_RUN_MS) stream.restartAttempt = 0;
        const delay = RESTART_DELAYS_MS[Math.min(stream.restartAttempt, RESTART_DELAYS_MS.length - 1)];
        stream.restartAttempt++;

        setState(stream, "error", `stream stopped (code ${code ?? "none"}${signal ? `, ${signal}` : ""}), restarting in ${delay / 1000}s`);
        stream.restartTimer = setTimeout(() => {
            stream.restartTimer = null;
            // A transient error state must not block the retry in syncStreams.
            stream.state = "starting";
            syncStreams();
        }, delay);
    });
}

function stopPipeline(stream: CameraStream, reason: string) {
    stream.stopping = true;
    stream.generation++;

    if (stream.restartTimer) {
        clearTimeout(stream.restartTimer);
        stream.restartTimer = null;
    }

    const child = stream.pipeline;
    stream.pipeline = null;
    stream.pipelineSignature = "";
    stream.encoder = "";
    stream.worker = {};

    if (child && child.exitCode === null && child.signalCode === null) {
        child.kill("SIGTERM");
        const killTimer = setTimeout(() => {
            if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
        }, 5_000);
        killTimer.unref();
        logRegular(`webcam stream ${stream.id} stopped (${reason})`);
    }
}

// ---------------------------------------------------------------------------
// Hotplug
// ---------------------------------------------------------------------------

function describeDevices() {
    return runtime.devices.map((device) => device.name).join(", ") || "none";
}

/** Re-scans cameras/accelerators/microphones; serialized, coalesces bursts. */
function refreshAfterHotplug() {
    if (deviceRefresh) {
        deviceRefreshPending = true;
        return;
    }

    const before = describeDevices();
    deviceRefresh = refreshDevices()
        .then(() => {
            if (describeDevices() !== before) logRegular(`webcam devices changed: ${describeDevices()}`);
            // Applies plugged/unplugged cameras and emits notify_webcam_update.
            syncStreams();
        })
        .catch((error) => logWarn(`webcam hotplug refresh failed: ${error?.message ?? error}`))
        .finally(() => {
            deviceRefresh = null;
            if (deviceRefreshPending) {
                deviceRefreshPending = false;
                refreshAfterHotplug();
            }
        });
}

async function refreshAudioSources() {
    try {
        runtime.audio_sources = await listAudioSources();
        emitWebcamUpdate();
    } catch (error: any) {
        logWarn(`webcam microphone refresh failed: ${error?.message ?? error}`);
    }
}

function handleHardwareChange(change: HardwareChange) {
    const pending = hotplugTimers[change];
    if (pending) clearTimeout(pending);

    hotplugTimers[change] = setTimeout(() => {
        delete hotplugTimers[change];
        if (change === "devices") refreshAfterHotplug();
        else void refreshAudioSources();
    }, HOTPLUG_DEBOUNCE_MS);
}

// ---------------------------------------------------------------------------
// Public actions
// ---------------------------------------------------------------------------

/** Another camera pinned to the same specific Coral. */
function coralConflict(cameras: WebcamCameraSettings[], camera: WebcamCameraSettings) {
    if (!camera.face_accelerator.startsWith("coral:")) return null;
    return cameras.find((other) => other.id !== camera.id && other.face_accelerator === camera.face_accelerator) ?? null;
}

export async function addWebcamCamera(input: Partial<WebcamCameraSettings>) {
    const config = getWebcamIntegration();
    const used = new Set(config.cameras.map((camera) => camera.device));
    const device = input.device
        ? findDevice(String(input.device))
        : runtime.devices.find((entry) => !used.has(entry.path));

    const camera = normalizeCamera(input, {
        ...CAMERA_DEFAULTS,
        id: newCameraId(),
        name: device?.name.replace(/:.*$/, "").trim() || `Webcam ${config.cameras.length + 1}`,
        device: device?.path ?? "",
    });
    if (coralConflict(config.cameras, camera)) {
        camera.face_accelerator = "auto";
    }

    config.cameras.push(camera);
    writeWebcamIntegration(config);
    syncStreams();
    return getWebcamUpdate();
}

export async function updateWebcamCamera(input: Partial<WebcamCameraSettings> & {id?: string}) {
    const config = getWebcamIntegration();
    const index = config.cameras.findIndex((camera) => camera.id === input?.id);
    if (index < 0) throw new Error("unknown camera");

    const next = normalizeCamera(input, config.cameras[index]);
    const conflict = coralConflict(config.cameras, next);
    if (conflict) {
        throw new Error(`this Coral can only be used by one camera and is already set for "${conflict.name}"`);
    }

    config.cameras[index] = next;
    writeWebcamIntegration(config);

    // A user action clears a previous error, so the camera is retried.
    const stream = streams.get(next.id);
    if (stream?.state === "error" && !stream.pipeline) {
        stream.state = "starting";
        stream.restartAttempt = 0;
    }

    syncStreams();
    return getWebcamUpdate();
}

export async function removeWebcamCamera(id: string) {
    const config = getWebcamIntegration();
    if (!config.cameras.some((camera) => camera.id === id)) throw new Error("unknown camera");

    config.cameras = config.cameras.filter((camera) => camera.id !== id);
    writeWebcamIntegration(config);

    const stream = streams.get(id);
    if (stream) {
        stopPipeline(stream, "camera removed");
        clearCredentials(stream, false);
        streams.delete(id);
    }
    // The cloud deletes the camera's stream key, its viewer link is gone.
    sendCloud({type: "webcam_camera_removed", camera_id: id});

    syncStreams();
    return getWebcamUpdate();
}

export async function installWebcamBlur() {
    if (installPromise) return getWebcamUpdate();

    const script = getScript("install_webcam_blur.sh");
    runtime.blur_install = {stage: "preparing"};
    runtime.blur_install_error = "";
    emitWebcamUpdate();

    installPromise = runStreaming("bash", [script], {
        env: {...process.env, WEBCAM_BLUR_ROOT: getBlurRoot()},
        onLine: (line) => {
            const step = line.match(/^Step:\s*(.+)$/);
            if (step) {
                runtime.blur_install = {stage: step[1]};
                emitWebcamUpdate();
                return;
            }
            logRegular(`webcam blur install: ${line}`);
        },
    })
        .then(() => {
            logSuccess("webcam privacy blur installed");
            // Cameras that were blocked by the missing blur retry now.
            for (const stream of streams.values()) {
                if (stream.state === "error" && !stream.pipeline) stream.state = "starting";
            }
            syncStreams();
        })
        .catch((error: any) => {
            runtime.blur_install_error = String(error?.message ?? error).split("\n").slice(-1)[0];
            logWarn(`webcam blur install failed: ${runtime.blur_install_error}`);
        })
        .finally(() => {
            installPromise = null;
            runtime.blur_install = null;
            emitWebcamUpdate();
            void emitStorageUpdate();
        });

    return getWebcamUpdate();
}

/**
 * Deletes the privacy blur install (Python env, models, GPU/Coral runtimes).
 * Cameras with blur enabled stop streaming until it is installed again, so
 * nothing is sent unblurred. The system-wide Coral udev rule is kept.
 */
export async function removeWebcamBlur() {
    if (installPromise) throw new Error("the privacy blur is being installed");

    const root = getBlurRoot();
    fs.rmSync(root, {recursive: true, force: true});
    logSuccess(`webcam privacy blur removed from ${root}`);

    // GPU runtime marker is gone, and blur cameras must stop (fail closed).
    runtime.accelerators = detectAccelerators(root);
    syncStreams();
    void emitStorageUpdate();

    return getWebcamUpdate();
}

export async function initWebcam() {
    try {
        await refreshDevices();
        migrateLegacyConfig();
        runtime.encoders = await getAvailableEncoders(getFfmpeg());
    } catch (error: any) {
        logWarn(`webcam hardware detection failed: ${error?.message ?? error}`);
    }

    hardwareMonitor ??= new HardwareMonitor(handleHardwareChange);
    hardwareMonitor.start();
    runtime.cloud_open = Boolean(getCloudClient()?.isOpen());
    syncStreams();
}

export function shutdownWebcam() {
    hardwareMonitor?.stop();
    hardwareMonitor = null;
    for (const timer of Object.values(hotplugTimers)) if (timer) clearTimeout(timer);
    for (const stream of streams.values()) {
        stopPipeline(stream, "shutdown");
    }
}

/** Internals for tests. */
export const webcamTestHooks = {assignAccelerators, runtime};
