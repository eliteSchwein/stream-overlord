import {spawn, execFile} from "child_process";
import {promisify} from "util";
import type WebsocketServer from "../clients/websocket/WebsocketServer";
import type {WebSocket} from "ws";
import {getAssetTuneSettings, getVirtualAudioCableSettings, type VirtualAudioCableSettings} from "./ConfigHelper";
import {logNotice, logRegular, logWarn} from "./LogHelper";

const execFileAsync = promisify(execFile);
const sampleRate = 48_000;
const channels = 2;
const opusBitrate = 320_000;

const mediamtxRtspBase = (process.env.STREAMBOT_MEDIAMTX_RTSP_URL || "rtsp://127.0.0.1:8554").replace(/\/+$/, "");
const mediamtxWebRtcPort = Math.max(1, Number(process.env.STREAMBOT_MEDIAMTX_WEBRTC_PORT || 8889));
const mediamtxPathPrefix = String(process.env.STREAMBOT_MEDIAMTX_PATH_PREFIX || "streambot")
    .trim()
    .replace(/^\/+|\/+$/g, "") || "streambot";

type CableRuntime = {
    config: VirtualAudioCableSettings;
    sinkName: string;
    publisherProcess: ReturnType<typeof spawn> | null;
    restartTimer: ReturnType<typeof setTimeout> | null;
    stopping: boolean;
    sinkReady: boolean;
    published: boolean;
};

let websocketServer: WebsocketServer | null = null;
const runtimes = new Map<string, CableRuntime>();

function sanitizeCableId(value: string): string {
    return String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "") || "cable";
}

function mediaPath(id: string): string {
    return `${mediamtxPathPrefix}/${sanitizeCableId(id)}`;
}

function publishUrl(id: string): string {
    return `${mediamtxRtspBase}/${mediaPath(id)}`;
}

export function getVirtualAudioCableSinkName(id: string): string {
    return `streambot_virtual_${sanitizeCableId(id)}`;
}

export function isVirtualAudioCableSink(name: string): boolean {
    const normalized = String(name ?? "").trim();
    return getVirtualAudioCableSettings().some(cable => cable.enabled && getVirtualAudioCableSinkName(cable.id) === normalized);
}

function getEnabledConfigs(): VirtualAudioCableSettings[] {
    return getVirtualAudioCableSettings().filter(cable => cable.enabled);
}

function runtimePayload(runtime: CableRuntime) {
    return {
        cable: runtime.config.id,
        device: runtime.config.name,
        sink_name: runtime.sinkName,
        active: runtime.published,
        sink_ready: runtime.sinkReady,
        transport: "webrtc",
        codec: "opus",
        sample_rate: sampleRate,
        channels,
        bitrate: opusBitrate,
        whep: {
            port: mediamtxWebRtcPort,
            path: `/${mediaPath(runtime.config.id)}/whep`,
        },
    };
}

function emitState(connection?: WebSocket) {
    if (!websocketServer) return;
    websocketServer.send("notify_virtual_audio_cables", {
        cables: [...runtimes.values()].map(runtimePayload),
    }, connection);
}

function syncRuntimeDefinitions() {
    const configs = getEnabledConfigs();
    const wanted = new Set(configs.map(config => config.id));

    for (const [id, runtime] of runtimes) {
        if (wanted.has(id)) continue;
        stopPublisher(runtime, "cable_removed");
        runtimes.delete(id);
    }

    for (const config of configs) {
        const existing = runtimes.get(config.id);
        if (existing) {
            const nameChanged = existing.config.name !== config.name;
            existing.config = config;
            existing.sinkName = getVirtualAudioCableSinkName(config.id);
            if (nameChanged) existing.sinkReady = false;
            continue;
        }

        runtimes.set(config.id, {
            config,
            sinkName: getVirtualAudioCableSinkName(config.id),
            publisherProcess: null,
            restartTimer: null,
            stopping: false,
            sinkReady: false,
            published: false,
        });
    }
}

async function runPactl(args: string[]): Promise<string> {
    const {stdout} = await execFileAsync("pactl", args, {encoding: "utf8", maxBuffer: 4 * 1024 * 1024});
    return stdout ?? "";
}

async function sinkExists(sinkName: string): Promise<boolean> {
    try {
        const output = await runPactl(["list", "sinks", "short"]);
        return output.split(/\r?\n/).some(line => line.trim().split(/\s+/)[1] === sinkName);
    } catch {
        return false;
    }
}

async function cleanupRemovedVirtualSinks(): Promise<void> {
    const wanted = new Set(getEnabledConfigs().map(config => getVirtualAudioCableSinkName(config.id)));

    try {
        const output = await runPactl(["list", "modules", "short"]);
        for (const line of output.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.includes("module-null-sink")) continue;

            const moduleId = trimmed.split(/\s+/)[0];
            const match = trimmed.match(/(?:^|\s)sink_name=([^\s]+)/);
            const sinkName = match?.[1]?.replace(/^['"]|['"]$/g, "");
            if (!moduleId || !sinkName?.startsWith("streambot_virtual_")) continue;
            if (wanted.has(sinkName)) continue;

            try {
                await runPactl(["unload-module", moduleId]);
                logRegular(`removed virtual audio output: ${sinkName}`);
            } catch (error: any) {
                logWarn(`removing virtual audio output ${sinkName} failed: ${error?.message ?? error}`);
            }
        }
    } catch (error: any) {
        logWarn(`listing virtual audio output modules failed: ${error?.message ?? error}`);
    }
}

async function ensureVirtualSink(runtime: CableRuntime): Promise<void> {
    const description = runtime.config.name;

    if (await sinkExists(runtime.sinkName)) {
        runtime.sinkReady = true;
        try {
            await runPactl([
                "update-sink-proplist",
                runtime.sinkName,
                `device.description=${description}`,
                `node.description=${description}`,
                `node.nick=${description}`,
            ]);
        } catch {}
        return;
    }

    try {
        await runPactl([
            "load-module", "module-null-sink",
            `sink_name=${runtime.sinkName}`,
            `rate=${sampleRate}`,
            `channels=${channels}`,
            "sink_properties=" + [
                `device.description=\"${description}\"`,
                `node.description=\"${description}\"`,
                `node.nick=\"${description}\"`,
                "node.virtual=true",
                "node.hidden=false",
                "device.api=virtual",
                "media.class=Audio/Sink",
                `streambot.virtual_audio_cable=${runtime.config.id}`,
            ].join(" "),
        ]);
    } catch (error: any) {
        if (!(await sinkExists(runtime.sinkName))) {
            runtime.sinkReady = false;
            throw new Error(`creating ${description} failed: ${error?.message ?? error}`);
        }
    }

    runtime.sinkReady = true;
    logNotice(`virtual audio output ready: ${description} (${runtime.sinkName})`);
}

function scheduleRestart(runtime: CableRuntime) {
    if (runtime.stopping || runtime.restartTimer) return;
    runtime.restartTimer = setTimeout(() => {
        runtime.restartTimer = null;
        if (!runtime.stopping) void startPublisher(runtime);
    }, 1500);
}

async function startPublisher(runtime: CableRuntime) {
    if (runtime.publisherProcess) return;

    try {
        await ensureVirtualSink(runtime);
    } catch (error: any) {
        logWarn(`virtual audio cable ${runtime.config.id} unavailable: ${error?.message ?? error}`);
        scheduleRestart(runtime);
        return;
    }

    const ffmpeg = getAssetTuneSettings().ffmpeg_bin || "ffmpeg";
    const outputUrl = publishUrl(runtime.config.id);
    const proc = spawn(ffmpeg, [
        "-hide_banner", "-loglevel", "warning",
        "-f", "pulse", "-i", `${runtime.sinkName}.monitor`,
        "-vn",
        "-ac", String(channels),
        "-ar", String(sampleRate),
        "-c:a", "libopus",
        "-b:a", String(opusBitrate),
        "-vbr", "on",
        "-compression_level", "10",
        "-application", "audio",
        "-frame_duration", "20",
        "-f", "rtsp",
        "-rtsp_transport", "tcp",
        outputUrl,
    ], {stdio: ["ignore", "ignore", "pipe"], env: process.env});

    runtime.stopping = false;
    runtime.publisherProcess = proc;
    runtime.published = true;
    emitState();

    proc.stderr?.on("data", (chunk: Buffer) => {
        const message = chunk.toString("utf8").trim();
        if (message) logWarn(`virtual audio ${runtime.config.id} publisher: ${message}`);
    });
    proc.on("error", error => logWarn(`virtual audio ${runtime.config.id} publisher failed: ${error.message}`));
    proc.on("close", (code, signal) => {
        if (runtime.publisherProcess === proc) runtime.publisherProcess = null;
        runtime.published = false;
        emitState();

        if (!runtime.stopping) {
            logWarn(`virtual audio ${runtime.config.id} publisher exited code=${code ?? "none"} signal=${signal ?? "none"}; restarting`);
            scheduleRestart(runtime);
        }
    });

    logNotice(`virtual audio WebRTC publisher started: ${runtime.config.name} -> ${outputUrl}`);
}

function stopPublisher(runtime: CableRuntime, reason = "stopped") {
    runtime.stopping = true;
    if (runtime.restartTimer) {
        clearTimeout(runtime.restartTimer);
        runtime.restartTimer = null;
    }

    const proc = runtime.publisherProcess;
    runtime.publisherProcess = null;
    runtime.published = false;
    if (proc) {
        try { proc.kill("SIGTERM"); } catch {}
    }
    logRegular(`virtual audio WebRTC publisher stopped: ${runtime.config.id} (${reason})`);
    emitState();
}

export async function setVirtualAudioCableState(cableId: string, volume: number, muted: boolean): Promise<void> {
    syncRuntimeDefinitions();
    const runtime = runtimes.get(cableId);
    if (!runtime) throw new Error(`unknown virtual audio cable: ${cableId}`);
    await ensureVirtualSink(runtime);
    const safeVolume = Math.max(0, Math.min(1, Number.isFinite(Number(volume)) ? Number(volume) : 1));
    await runPactl(["set-sink-volume", runtime.sinkName, `${Math.round(safeVolume * 100)}%`]);
    await runPactl(["set-sink-mute", runtime.sinkName, muted ? "1" : "0"]);
}

export async function syncVirtualAudioCableConfiguration(): Promise<void> {
    syncRuntimeDefinitions();
    await cleanupRemovedVirtualSinks();

    await Promise.all([...runtimes.values()].map(async runtime => {
        try {
            await ensureVirtualSink(runtime);
            if (!runtime.publisherProcess) await startPublisher(runtime);
        } catch (error: any) {
            logWarn(`synchronizing virtual audio cable ${runtime.config.id} failed: ${error?.message ?? error}`);
        }
    }));

    emitState();
}

export async function initVirtualAudioCable(server: WebsocketServer) {
    websocketServer = server;
    syncRuntimeDefinitions();
    await cleanupRemovedVirtualSinks();

    await Promise.all([...runtimes.values()].map(async runtime => {
        try {
            await ensureVirtualSink(runtime);
            await startPublisher(runtime);
        } catch (error: any) {
            logWarn(`initializing virtual audio cable ${runtime.config.id} failed: ${error?.message ?? error}`);
        }
    }));

    emitState();
}

/**
 * Compatibility no-op for old call sites. Streaming is no longer tied to
 * WebSocket listeners; MediaMTX is the media plane and WebSocket is signaling only.
 */
export async function syncVirtualAudioCableStreaming(server: WebsocketServer) {
    websocketServer = server;
    emitState();
}

export function getVirtualAudioCableReplayNotifications(): Record<string, any>[] {
    return [];
}

export function getVirtualAudioCables() {
    syncRuntimeDefinitions();
    return [...runtimes.values()].map(runtimePayload);
}

export function sendVirtualAudioCableState(connection?: WebSocket) {
    syncRuntimeDefinitions();
    emitState(connection);
}
