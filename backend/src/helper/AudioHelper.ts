import { execFile } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { getConfig } from "./ConfigHelper";
import getWebsocketServer from "../App";
import { execute } from "./CommandHelper";
import { logRegular, logWarn } from "./LogHelper";
import { updateMusicVolumeFromAudio } from "./MusicHelper";

const audioVolumeSavePath = path.join(os.homedir(), "streambot-audio.json");

let audioData: any = {};
let audioOutputs: any[] = [];
let audioOutputsLastRefresh = 0;
let audioOutputsRefreshPromise: Promise<void> | null = null;
let sendAudioUpdatePromise: Promise<void> | null = null;
let sendAudioUpdatePending = false;

const audioOutputsRefreshIntervalMs = 2000;

const pipewireLoopbackModuleIds: Record<string, string[]> = {};
const pipewireLoopbackSinkInputIds: Record<string, string[]> = {};

export async function initAudio() {
    const config = getConfig(/audio /g, true);
    const savedVolumes = loadSavedAudioVolumes();

    audioData = {};

    for (const key in config) {
        const linkedOutputs = normalizeLinkedOutputs(
            savedVolumes[key]?.linked_outputs ??
            savedVolumes[key]?.linked_output ??
            config[key]?.linked_outputs ??
            config[key]?.linked_output ??
            null,
        );

        audioData[key] = {
            ...config[key],
            linked_outputs: linkedOutputs,
            linked_output: linkedOutputs[0] ?? null,
        };

        const savedVolume = Number(savedVolumes[key]?.current_volume);
        const volume = Number.isFinite(savedVolume)
            ? savedVolume
            : Number(audioData[key].default_volume ?? 0.2);

        if (isEnabled(audioData[key].pipewire_sink)) {
            await setupPipewireAudioSink(key, audioData[key].linked_outputs ?? []);
            await setPipewireSinkOutputVolume(key, volume);

            const sinkVolume = await getPipewireSinkOutputVolume(key);
            applyAudioVolumeState(key, sinkVolume ?? volume);
            saveAudioVolumes();
            continue;
        }

        await setVolume(key, volume, false, false);
    }

    await sendAudioUpdate();
}

export async function setVolume(
    audioInterface: string,
    volume: number,
    sendUpdate = true,
    saveUpdate = true,
) {
    const currentAudioData = audioData[audioInterface];

    if (!currentAudioData) return;

    const safeVolume = normalizeVolume(volume);

    if (isEnabled(currentAudioData.pipewire_sink)) {
        await setPipewireSinkOutputVolume(audioInterface, safeVolume);

        const actualVolume = await getPipewireSinkOutputVolume(audioInterface);
        applyAudioVolumeState(audioInterface, actualVolume ?? safeVolume);
    } else {
        if (currentAudioData.command) {
            try {
                await execute(`${currentAudioData.command} ${safeVolume}`);
            } catch (error) {
                logWarn(`setting volume for ${audioInterface} failed:`);
                logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
            }
        }

        applyAudioVolumeState(audioInterface, safeVolume);
    }

    if (saveUpdate) {
        saveAudioVolumes();
    }

    if (!sendUpdate) return;

    await sendAudioUpdate();
}

export async function linkPipewireSinkToAudioOutput(
    audioInterface: string,
    outputName: string,
) {
    const currentAudioData = audioData[audioInterface];

    if (!currentAudioData) return { error: "unknown interface" };
    if (!isEnabled(currentAudioData.pipewire_sink)) return { error: "interface is not a pipewire sink" };
    if (!outputName) return { error: "missing output" };

    const outputs = await getAvailableAudioOutputs();
    const output = outputs.find(item => item.name === outputName);

    if (!output) return { error: "unknown output" };

    const linkedOutputs = normalizeLinkedOutputs(currentAudioData.linked_outputs ?? currentAudioData.linked_output);

    if (!linkedOutputs.includes(output.name)) {
        linkedOutputs.push(output.name);
    }

    currentAudioData.linked_outputs = linkedOutputs;
    currentAudioData.linked_output = linkedOutputs[0] ?? null;
    audioData[audioInterface] = currentAudioData;

    const wantedVolume = Number(currentAudioData.current_volume ?? currentAudioData.default_volume ?? 0.2);

    await setupPipewireAudioSink(audioInterface, linkedOutputs);
    await setPipewireSinkOutputVolume(audioInterface, wantedVolume);

    const volume = await getPipewireSinkOutputVolume(audioInterface);
    applyAudioVolumeState(audioInterface, volume ?? wantedVolume);

    saveAudioVolumes();
    await sendAudioUpdate(true);

    return {
        linked: true,
        interface: audioInterface,
        output: output.name,
        outputs: linkedOutputs,
    };
}

export async function unlinkPipewireSinkFromAudioOutput(
    audioInterface: string,
    outputName: string | null = null,
) {
    const currentAudioData = audioData[audioInterface];

    if (!currentAudioData) return { error: "unknown interface" };
    if (!isEnabled(currentAudioData.pipewire_sink)) return { error: "interface is not a pipewire sink" };

    let linkedOutputs = normalizeLinkedOutputs(currentAudioData.linked_outputs ?? currentAudioData.linked_output);

    if (outputName) {
        linkedOutputs = linkedOutputs.filter(output => output !== outputName);
    } else {
        linkedOutputs = [];
    }

    currentAudioData.linked_outputs = linkedOutputs;
    currentAudioData.linked_output = linkedOutputs[0] ?? null;
    audioData[audioInterface] = currentAudioData;

    const wantedVolume = Number(currentAudioData.current_volume ?? currentAudioData.default_volume ?? 0.2);

    await setupPipewireAudioSink(audioInterface, linkedOutputs);
    await setPipewireSinkOutputVolume(audioInterface, wantedVolume);

    const volume = await getPipewireSinkOutputVolume(audioInterface);
    applyAudioVolumeState(audioInterface, volume ?? wantedVolume);

    saveAudioVolumes();
    await sendAudioUpdate(true);

    return {
        unlinked: true,
        interface: audioInterface,
        output: outputName,
        outputs: linkedOutputs,
    };
}

function applyAudioVolumeState(audioInterface: string, volume: number) {
    const currentAudioData = audioData[audioInterface];

    if (!currentAudioData) return;

    const safeVolume = normalizeVolume(volume);

    if (safeVolume === 0) {
        logRegular(`mute ${audioInterface}`);
        currentAudioData.muted = true;

        if (!currentAudioData.current_volume) {
            currentAudioData.current_volume = Number(currentAudioData.min_range ?? 0);
        }
    } else {
        logRegular(`set volume for ${audioInterface} to ${safeVolume}`);
        currentAudioData.current_volume = safeVolume;
        currentAudioData.muted = false;
    }

    audioData[audioInterface] = currentAudioData;
}

function normalizeVolume(volume: number): number {
    const parsed = Number(volume);

    if (!Number.isFinite(parsed)) return 0;

    return Math.max(0, Math.min(1, parsed));
}

function loadSavedAudioVolumes() {
    if (!existsSync(audioVolumeSavePath)) return {};

    try {
        return JSON.parse(readFileSync(audioVolumeSavePath, "utf8"));
    } catch (error) {
        logWarn("loading saved audio volumes failed:");
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        return {};
    }
}

function saveAudioVolumes() {
    const data: any = {};

    for (const key in audioData) {
        data[key] = {
            current_volume: audioData[key].current_volume,
            muted: audioData[key].muted === true,
        };

        if (isEnabled(audioData[key].pipewire_sink)) {
            const linkedOutputs = normalizeLinkedOutputs(audioData[key].linked_outputs ?? audioData[key].linked_output);
            data[key].linked_outputs = linkedOutputs;
            data[key].linked_output = linkedOutputs[0] ?? null;
        }
    }

    try {
        writeFileSync(audioVolumeSavePath, JSON.stringify(data, null, 4));
    } catch (error) {
        logWarn("saving audio volumes failed:");
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
}

export async function sendAudioUpdate(forceAudioOutputs = false) {
    if (sendAudioUpdatePromise) {
        sendAudioUpdatePending = true;
        return sendAudioUpdatePromise;
    }

    sendAudioUpdatePromise = runAudioUpdate(forceAudioOutputs);

    try {
        await sendAudioUpdatePromise;
    } finally {
        sendAudioUpdatePromise = null;

        if (sendAudioUpdatePending) {
            sendAudioUpdatePending = false;
            void sendAudioUpdate(false);
        }
    }
}

async function runAudioUpdate(forceAudioOutputs = false) {
    await refreshPipewireSinkVolumes();
    await refreshAudioOutputs(forceAudioOutputs);
    await updateMusicVolumeFromAudio(audioData);

    getWebsocketServer().send("notify_audio_update", audioData);
    getWebsocketServer().send("notify_audio_outputs_update", audioOutputs);
}

async function refreshPipewireSinkVolumes() {
    let changed = false;

    for (const key in audioData) {
        if (!isEnabled(audioData[key].pipewire_sink)) continue;

        const volume = await getPipewireSinkOutputVolume(key);
        if (volume === null) continue;

        const currentVolume = Number(audioData[key].current_volume);
        const currentMuted = audioData[key].muted === true;
        const nextMuted = volume === 0;

        if (currentVolume !== volume || currentMuted !== nextMuted) {
            applyAudioVolumeState(key, volume);
            changed = true;
        }
    }

    if (changed) {
        saveAudioVolumes();
    }
}

async function refreshAudioOutputs(force = false) {
    const now = Date.now();

    if (!force && audioOutputs.length > 0 && now - audioOutputsLastRefresh < audioOutputsRefreshIntervalMs) {
        return;
    }

    if (audioOutputsRefreshPromise) {
        await audioOutputsRefreshPromise;
        return;
    }

    audioOutputsRefreshPromise = (async () => {
        audioOutputs = await getAvailableAudioOutputs();
        audioOutputsLastRefresh = Date.now();
    })();

    try {
        await audioOutputsRefreshPromise;
    } finally {
        audioOutputsRefreshPromise = null;
    }
}

export async function getAvailableAudioOutputs() {
    const outputs: any[] = [];

    try {
        const defaultSink = await getDefaultAudioSinkName();

        const shortOutput = await runCommandWithOutput("pactl", [
            "list",
            "sinks",
            "short",
        ]);

        const detailedOutput = await runCommandWithOutput("pactl", [
            "list",
            "sinks",
        ]);

        const details = parsePactlSinkDetails(detailedOutput);
        const outputNameById: Record<string, string> = {};

        for (const line of shortOutput.split(/\r?\n/)) {
            if (!line.trim()) continue;

            const parts = line.trim().split(/\s+/);
            const id = parts[0];
            const name = parts[1];

            if (id && name && !isStreambotAudioSink(name, details[name]?.description)) {
                outputNameById[id] = name;
            }
        }

        const activePipewireLinks = await getActivePipewireSinkLinks(outputNameById);

        for (const line of shortOutput.split(/\r?\n/)) {
            if (!line.trim()) continue;

            const parts = line.trim().split(/\s+/);
            const id = parts[0];
            const name = parts[1];
            const driver = parts[2] ?? null;
            const format = parts.slice(3).join(" ") || null;
            const detail = details[name] ?? {};

            if (!name) continue;
            if (isStreambotAudioSink(name, detail.description)) continue;

            const isDefault = defaultSink === name;
            const state = detail.state ?? null;
            const active = isDefault && String(state ?? "").toUpperCase() === "RUNNING";

            outputs.push({
                id,
                name,
                description: detail.description ?? name,
                driver,
                format,
                state,
                volume: detail.volume ?? null,
                muted: detail.muted ?? false,
                is_default: isDefault,
                default: isDefault,
                is_active_default: active,
                active,
                linked_interfaces: getLinkedInterfacesForOutput(name, activePipewireLinks),
            });
        }
    } catch (error) {
        logWarn("loading audio outputs failed:");
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }

    return outputs;
}

async function getDefaultAudioSinkName(): Promise<string | null> {
    try {
        const output = await runCommandWithOutput("pactl", ["get-default-sink"]);
        const sinkName = output.trim();

        if (sinkName) return sinkName;
    } catch {}

    try {
        const info = await runCommandWithOutput("pactl", ["info"]);
        return info.match(/Default Sink:\s*(.+)/)?.[1]?.trim() ?? null;
    } catch {
        return null;
    }
}

function isStreambotAudioSink(name: string, description?: string | null): boolean {
    return name.startsWith("streambot_") || (description ?? "").startsWith("streambot_");
}

function parsePactlSinkDetails(output: string): Record<string, any> {
    const result: Record<string, any> = {};
    const blocks = output.split(/Sink #/).slice(1);

    for (const block of blocks) {
        const name = block.match(/\n\s*Name:\s*(.+)/)?.[1]?.trim();
        if (!name) continue;

        const description = block.match(/\n\s*Description:\s*(.+)/)?.[1]?.trim();
        const state = block.match(/\n\s*State:\s*(.+)/)?.[1]?.trim();
        const muted = block.match(/\n\s*Mute:\s*(yes|no)/)?.[1]?.trim() === "yes";
        const volumeMatch = block.match(/\n\s*Volume:.*?(\d+)%/);
        const volumePercent = Number(volumeMatch?.[1]);

        result[name] = {
            description,
            state,
            muted,
            volume: Number.isFinite(volumePercent) ? volumePercent / 100 : null,
        };
    }

    return result;
}

async function getActivePipewireSinkLinks(
    outputNameById: Record<string, string>,
): Promise<Record<string, string[]>> {
    const result: Record<string, string[]> = {};

    try {
        const output = await runCommandWithOutput("pactl", [
            "list",
            "sink-inputs",
        ]);

        const blocks = output.split(/Sink Input #/).slice(1);

        for (const key in audioData) {
            if (!isEnabled(audioData[key]?.pipewire_sink)) continue;

            const sinkName = getStreambotSinkName(key);
            const moduleIds = pipewireLoopbackModuleIds[key] ?? [];

            for (const block of blocks) {
                const isLoopbackForSink =
                    block.includes(`${sinkName}.monitor`) ||
                    moduleIds.some(moduleId => block.includes(`Owner Module: ${moduleId}`));

                if (!isLoopbackForSink) continue;

                const sinkId = block.match(/\n\s*Sink:\s*(\d+)/)?.[1]?.trim();
                const outputName = sinkId ? outputNameById[sinkId] : null;

                if (!outputName) continue;

                if (!result[key]) result[key] = [];
                if (!result[key].includes(outputName)) result[key].push(outputName);

                audioData[key].actual_linked_outputs = result[key];
                audioData[key].actual_linked_output = result[key][0] ?? null;
            }
        }
    } catch {}

    return result;
}

function getLinkedInterfacesForOutput(
    outputName: string,
    activePipewireLinks: Record<string, string[]> = {},
): string[] {
    const result = new Set<string>();

    for (const key in audioData) {
        const configuredOutputs = normalizeLinkedOutputs(audioData[key]?.linked_outputs ?? audioData[key]?.linked_output);
        const activeOutputs = normalizeLinkedOutputs(activePipewireLinks[key]);

        if (configuredOutputs.includes(outputName) || activeOutputs.includes(outputName)) {
            result.add(key);
        }
    }

    return Array.from(result);
}

function normalizeLinkedOutputs(value: any): string[] {
    if (Array.isArray(value)) {
        return Array.from(new Set(value.map(item => String(item).trim()).filter(Boolean)));
    }

    if (typeof value === "string" && value.trim()) {
        return [value.trim()];
    }

    return [];
}

function isEnabled(value: any): boolean {
    return value === true || value === "true";
}

export function getStreambotSinkName(configName: string): string {
    return `streambot_${configName}`;
}

export async function setupPipewireAudioSink(
    configName: string,
    outputNames: string[] | string | null = audioData[configName]?.linked_outputs ?? audioData[configName]?.linked_output ?? [],
) {
    const sinkName = getStreambotSinkName(configName);
    const linkedOutputs = normalizeLinkedOutputs(outputNames);

    await cleanupPipewireAudioSink(configName);
    await cleanupExistingPipewireAudioSinkModules(configName);

    try {
        await runCommand("pactl", [
            "load-module",
            "module-null-sink",
            `sink_name=${sinkName}`,
            "sink_properties=" + [
                `device.description=${sinkName}`,
                `node.description=${sinkName}`,
                `node.nick=${sinkName}`,
                "node.virtual=true",
                "node.hidden=true",
                "device.api=virtual",
                "media.class=Audio/Sink",
            ].join(" "),
        ]);
    } catch {
        // sink probably already exists
    }

    const targets = linkedOutputs.length > 0 ? linkedOutputs : [null];
    const moduleIds: string[] = [];

    for (const outputName of targets) {
        try {
            const loopbackArgs = [
                "load-module",
                "module-loopback",
                `source=${sinkName}.monitor`,
                "latency_msec=30",
            ];

            if (outputName) {
                loopbackArgs.push(`sink=${outputName}`);
            }

            const output = await runCommandWithOutput("pactl", loopbackArgs);
            const moduleId = output.trim();

            if (moduleId) moduleIds.push(moduleId);
        } catch {}
    }

    pipewireLoopbackModuleIds[configName] = moduleIds;

    await sleep(500);

    pipewireLoopbackSinkInputIds[configName] =
        await findPipewireLoopbackSinkInputIds(configName);
}

export async function cleanupPipewireAudioSink(configName: string) {
    const moduleIds = pipewireLoopbackModuleIds[configName] ?? [];

    for (const moduleId of moduleIds) {
        try {
            await runCommand("pactl", ["unload-module", moduleId]);
        } catch {}
    }

    pipewireLoopbackModuleIds[configName] = [];
    pipewireLoopbackSinkInputIds[configName] = [];
}

async function cleanupExistingPipewireAudioSinkModules(configName: string) {
    const sinkName = getStreambotSinkName(configName);
    const moduleIds = new Set<string>();

    try {
        const modules = await runCommandWithOutput("pactl", [
            "list",
            "modules",
            "short",
        ]);

        for (const line of modules.split(/\r?\n/)) {
            if (!line.includes(sinkName)) continue;

            const moduleId = line.trim().split(/\s+/)[0];

            if (moduleId) moduleIds.add(moduleId);
        }
    } catch {}

    for (const moduleId of moduleIds) {
        try {
            await runCommand("pactl", ["unload-module", moduleId]);
        } catch {}
    }
}

export async function cleanupAllStreambotAudioSinks() {
    const moduleIds = new Set<string>();

    try {
        const modules = await runCommandWithOutput("pactl", [
            "list",
            "modules",
            "short",
        ]);

        for (const line of modules.split(/\r?\n/)) {
            if (!/streambot_/i.test(line)) continue;

            const moduleId = line.trim().split(/\s+/)[0];

            if (moduleId) moduleIds.add(moduleId);
        }
    } catch {}

    for (const moduleId of moduleIds) {
        try {
            await runCommand("pactl", ["unload-module", moduleId]);
        } catch {}
    }

    for (const key in pipewireLoopbackModuleIds) {
        pipewireLoopbackModuleIds[key] = [];
        pipewireLoopbackSinkInputIds[key] = [];
    }
}

export async function setPipewireSinkOutputVolume(
    configName: string,
    volume: number,
): Promise<void> {
    const safeVolume = normalizeVolume(volume);

    if (!pipewireLoopbackSinkInputIds[configName]?.length) {
        pipewireLoopbackSinkInputIds[configName] =
            await findPipewireLoopbackSinkInputIds(configName);
    }

    const sinkInputIds = pipewireLoopbackSinkInputIds[configName] ?? [];

    if (!sinkInputIds.length) {
        logWarn(`${getStreambotSinkName(configName)} loopback sink-input not found`);
        return;
    }

    for (const sinkInputId of sinkInputIds) {
        try {
            await runCommand("pactl", [
                "set-sink-input-volume",
                sinkInputId,
                `${Math.round(safeVolume * 100)}%`,
            ]);
        } catch (error) {
            logWarn(`setting volume for ${configName} sink-input ${sinkInputId} failed:`);
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        }
    }
}

export async function getPipewireSinkOutputVolumePercent(
    configName: string,
): Promise<number> {
    const volume = await getPipewireSinkOutputVolume(configName);

    if (volume === null) return 20;

    return Math.round(Math.max(0, Math.min(1, volume)) * 100);
}

export async function getPipewireSinkOutputVolume(
    configName: string,
): Promise<number | null> {
    if (!pipewireLoopbackSinkInputIds[configName]?.length) {
        pipewireLoopbackSinkInputIds[configName] =
            await findPipewireLoopbackSinkInputIds(configName);
    }

    const sinkInputIds = pipewireLoopbackSinkInputIds[configName] ?? [];

    if (!sinkInputIds.length) return null;

    try {
        const output = await runCommandWithOutput("pactl", [
            "list",
            "sink-inputs",
        ]);

        const blocks = output.split(/Sink Input #/).slice(1);
        const volumes: number[] = [];

        for (const sinkInputId of sinkInputIds) {
            const block = blocks.find(block => {
                const id = block.split(/\r?\n/)[0]?.trim();
                return id === sinkInputId;
            });

            if (!block) continue;

            const muted = block.match(/\n\s*Mute:\s*(yes|no)/)?.[1]?.trim() === "yes";
            if (muted) {
                volumes.push(0);
                continue;
            }

            const match = block.match(/\n\s*Volume:.*?(\d+)%/);
            const volume = Number(match?.[1]);

            if (Number.isFinite(volume)) {
                volumes.push(Math.max(0, Math.min(1, volume / 100)));
            }
        }

        if (volumes.length > 0) return volumes[0];
    } catch {}

    return null;
}

async function findPipewireLoopbackSinkInputIds(
    configName: string,
): Promise<string[]> {
    const sinkName = getStreambotSinkName(configName);
    const moduleIds = pipewireLoopbackModuleIds[configName] ?? [];
    const result: string[] = [];

    try {
        const output = await runCommandWithOutput("pactl", [
            "list",
            "sink-inputs",
        ]);

        const blocks = output.split(/Sink Input #/).slice(1);

        for (const block of blocks) {
            const id = block.split(/\r?\n/)[0]?.trim();

            if (!id || !/^\d+$/.test(id)) continue;

            if (moduleIds.some(moduleId => block.includes(`Owner Module: ${moduleId}`))) {
                result.push(id);
            }
        }

        if (result.length > 0) return Array.from(new Set(result));

        for (const block of blocks) {
            const id = block.split(/\r?\n/)[0]?.trim();

            const isLoopback =
                block.includes("module-loopback") ||
                block.includes('application.name = "PulseAudio Loopback"') ||
                block.includes('application.name = "PipeWire"') ||
                block.includes('media.name = "Loopback');

            const isFromStreambot = block.includes(`${sinkName}.monitor`);

            if (id && /^\d+$/.test(id) && isLoopback && isFromStreambot) {
                result.push(id);
            }
        }
    } catch {}

    return Array.from(new Set(result));
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function runCommand(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        execFile(command, args, (error, stdout, stderr) => {
            if (stdout) logRegular(stdout.trim());
            if (stderr) logWarn(stderr.trim());

            if (error) {
                reject(error);
                return;
            }

            resolve();
        });
    });
}

function runCommandWithOutput(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile(command, args, (error, stdout, stderr) => {
            if (stderr) logWarn(stderr.trim());

            if (error) {
                reject(error);
                return;
            }

            resolve(stdout);
        });
    });
}

export function getAudioData() {
    return audioData;
}

export function getAudioOutputs() {
    return audioOutputs;
}
