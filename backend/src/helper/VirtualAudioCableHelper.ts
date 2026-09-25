import {spawn, execFile} from "child_process";
import {promisify} from "util";
import type WebsocketServer from "../clients/websocket/WebsocketServer";
import {getAssetTuneSettings, getVirtualAudioCableSettings, type VirtualAudioCableSettings} from "./ConfigHelper";
import {logNotice, logRegular, logWarn} from "./LogHelper";

const execFileAsync = promisify(execFile);
const sampleRate = 48_000;
const channels = 2;
const bytesPerSample = 2;
const bytesPerFrame = channels * bytesPerSample;
const targetChunkMs = 20;
const targetChunkBytes = Math.max(bytesPerFrame, Math.floor(sampleRate * (targetChunkMs / 1000)) * bytesPerFrame);

type CableRuntime = {
    config: VirtualAudioCableSettings;
    sinkName: string;
    captureProcess: ReturnType<typeof spawn> | null;
    captureRemainder: Buffer;
    sequence: number;
    restartTimer: ReturnType<typeof setTimeout> | null;
    stopping: boolean;
    sinkReady: boolean;
    captureWanted: boolean;
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

function syncRuntimeDefinitions() {
    const configs = getEnabledConfigs();
    const wanted = new Set(configs.map(config => config.id));

    for (const [id, runtime] of runtimes) {
        if (wanted.has(id)) continue;
        stopCapture(runtime, "cable_removed");
        runtimes.delete(id);
    }

    for (const config of configs) {
        const existing = runtimes.get(config.id);
        if (existing) {
            existing.config = config;
            existing.sinkName = getVirtualAudioCableSinkName(config.id);
            continue;
        }

        runtimes.set(config.id, {
            config,
            sinkName: getVirtualAudioCableSinkName(config.id),
            captureProcess: null,
            captureRemainder: Buffer.alloc(0),
            sequence: 0,
            restartTimer: null,
            stopping: false,
            sinkReady: false,
            captureWanted: false,
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
    const wanted = new Set(
        getEnabledConfigs().map(config => getVirtualAudioCableSinkName(config.id))
    );

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

function notifyStart(runtime: CableRuntime) {
    if (!websocketServer) return 0;
    return websocketServer.send("notify_audio_stream", {
        action: "start",
        cable: runtime.config.id,
        device: runtime.config.name,
        sink_name: runtime.sinkName,
        codec: "pcm_s16le",
        sample_rate: sampleRate,
        channels,
        bytes_per_sample: bytesPerSample,
        sequence: runtime.sequence,
    });
}

function notifyStop(runtime: CableRuntime, reason: string) {
    if (!websocketServer) return 0;
    return websocketServer.send("notify_audio_stream", {
        action: "stop",
        cable: runtime.config.id,
        sequence: runtime.sequence,
        reason,
    });
}

function sendPcmChunk(runtime: CableRuntime, chunk: Buffer) {
    if (!websocketServer || chunk.length === 0) return;
    runtime.sequence += 1;
    websocketServer.send("notify_audio_stream", {
        action: "data",
        cable: runtime.config.id,
        codec: "pcm_s16le",
        sample_rate: sampleRate,
        channels,
        sequence: runtime.sequence,
        data: chunk.toString("base64"),
    });
}

function processCaptureBytes(runtime: CableRuntime, data: Buffer) {
    const buffer = runtime.captureRemainder.length ? Buffer.concat([runtime.captureRemainder, data]) : data;
    const alignedLength = buffer.length - (buffer.length % bytesPerFrame);
    if (alignedLength <= 0) {
        runtime.captureRemainder = buffer;
        return;
    }

    const aligned = buffer.subarray(0, alignedLength);
    runtime.captureRemainder = buffer.subarray(alignedLength);

    let offset = 0;
    while (offset < aligned.length) {
        let end = Math.min(aligned.length, offset + targetChunkBytes);
        end -= (end - offset) % bytesPerFrame;
        if (end <= offset) break;
        sendPcmChunk(runtime, aligned.subarray(offset, end));
        offset = end;
    }
}

function scheduleRestart(runtime: CableRuntime) {
    if (!runtime.captureWanted || runtime.restartTimer) return;
    runtime.restartTimer = setTimeout(() => {
        runtime.restartTimer = null;
        if (runtime.captureWanted) void startCapture(runtime);
    }, 1000);
}

async function startCapture(runtime: CableRuntime) {
    if (runtime.captureProcess || !runtime.captureWanted) return;

    try {
        await ensureVirtualSink(runtime);
    } catch (error: any) {
        logWarn(`virtual audio cable ${runtime.config.id} unavailable: ${error?.message ?? error}`);
        scheduleRestart(runtime);
        return;
    }

    const ffmpeg = getAssetTuneSettings().ffmpeg_bin || "ffmpeg";
    const proc = spawn(ffmpeg, [
        "-hide_banner", "-loglevel", "warning",
        "-f", "pulse", "-i", `${runtime.sinkName}.monitor`,
        "-vn", "-ac", String(channels), "-ar", String(sampleRate),
        "-f", "s16le", "pipe:1",
    ], {stdio: ["ignore", "pipe", "pipe"], env: process.env});

    runtime.stopping = false;
    runtime.captureRemainder = Buffer.alloc(0);
    runtime.sequence = 0;
    runtime.captureProcess = proc;

    proc.stdout?.on("data", (chunk: Buffer) => processCaptureBytes(runtime, chunk));
    proc.stderr?.on("data", (chunk: Buffer) => {
        const message = chunk.toString("utf8").trim();
        if (message) logWarn(`virtual audio ${runtime.config.id} ffmpeg: ${message}`);
    });
    proc.on("error", error => logWarn(`virtual audio ${runtime.config.id} capture failed: ${error.message}`));
    proc.on("close", (code, signal) => {
        if (runtime.captureProcess === proc) runtime.captureProcess = null;
        runtime.captureRemainder = Buffer.alloc(0);
        if (!runtime.stopping && runtime.captureWanted) {
            logWarn(`virtual audio ${runtime.config.id} capture exited code=${code ?? "none"} signal=${signal ?? "none"}; restarting`);
            scheduleRestart(runtime);
        }
    });

    const listeners = notifyStart(runtime);
    logNotice(`virtual audio stream started: ${runtime.config.name} (${runtime.config.id}), listeners=${listeners}`);
}

function stopCapture(runtime: CableRuntime, reason = "no_listeners") {
    runtime.captureWanted = false;
    if (runtime.restartTimer) {
        clearTimeout(runtime.restartTimer);
        runtime.restartTimer = null;
    }
    const proc = runtime.captureProcess;
    if (!proc) return;
    runtime.stopping = true;
    runtime.captureProcess = null;
    runtime.captureRemainder = Buffer.alloc(0);
    notifyStop(runtime, reason);
    try { proc.kill("SIGTERM"); } catch {}
    logRegular(`virtual audio stream stopped: ${runtime.config.id} (${reason})`);
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
        } catch (error: any) {
            logWarn(`synchronizing virtual audio cable ${runtime.config.id} failed: ${error?.message ?? error}`);
        }
    }));

    if (websocketServer) {
        await syncVirtualAudioCableStreaming(websocketServer);
    }
}

export async function initVirtualAudioCable(server: WebsocketServer) {
    websocketServer = server;
    syncRuntimeDefinitions();
    await Promise.all([...runtimes.values()].map(async runtime => {
        try { await ensureVirtualSink(runtime); }
        catch (error: any) { logWarn(`initializing virtual audio cable ${runtime.config.id} failed: ${error?.message ?? error}`); }
    }));
    await syncVirtualAudioCableStreaming(server);
}

export async function syncVirtualAudioCableStreaming(server: WebsocketServer) {
    websocketServer = server;
    syncRuntimeDefinitions();
    const listeners = server.getEndpointSubscriberCount("notify_audio_stream");

    await Promise.all([...runtimes.values()].map(async runtime => {
        if (listeners > 0) {
            runtime.captureWanted = true;
            if (!runtime.captureProcess) await startCapture(runtime);
        } else {
            stopCapture(runtime, "no_listeners");
        }
    }));
}

export function getVirtualAudioCableReplayNotifications(): Record<string, any>[] {
    syncRuntimeDefinitions();
    return [...runtimes.values()]
        .filter(runtime => Boolean(runtime.captureProcess))
        .map(runtime => ({
            action: "start",
            cable: runtime.config.id,
            device: runtime.config.name,
            sink_name: runtime.sinkName,
            codec: "pcm_s16le",
            sample_rate: sampleRate,
            channels,
            bytes_per_sample: bytesPerSample,
            sequence: runtime.sequence,
            replay: true,
        }));
}

export function getVirtualAudioCables() {
    syncRuntimeDefinitions();
    return [...runtimes.values()].map(runtime => ({
        cable: runtime.config.id,
        sink_name: runtime.sinkName,
        device: runtime.config.name,
        codec: "pcm_s16le",
        sample_rate: sampleRate,
        channels,
        active: Boolean(runtime.captureProcess),
        sink_ready: runtime.sinkReady,
        listeners: websocketServer?.getEndpointSubscriberCount("notify_audio_stream") ?? 0,
    }));
}
