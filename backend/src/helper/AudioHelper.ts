import {execFile, spawn} from "child_process";
import {existsSync, readFileSync, writeFileSync} from "fs";
import path from "path";
import {getConfig, getSystemConfigDirectory} from "./ConfigHelper";
import getWebsocketServer from "../App";
import {execute} from "./CommandHelper";
import {logRegular, logWarn} from "./LogHelper";
import {updateMusicVolumeFromAudio} from "./MusicHelper";
import {sleep} from "../../../helper/GeneralHelper";
import {triggerConfiguredEvent} from "./EventHelper";

const audioVolumeSavePath = path.join(getSystemConfigDirectory(), "streambot-audio.json");
const audioPresetSavePath = path.join(getSystemConfigDirectory(), "streambot-audio-presets.json");

let audioData: any = {};
let audioPresets: Record<string, any> = {};
let audioOutputs: any[] = [];
let audioOutputsLastRefresh = 0;
let audioOutputsRefreshPromise: Promise<void> | null = null;
let sendAudioUpdatePromise: Promise<void> | null = null;
let sendAudioUpdatePending = false;
let audioSubscriptionProcess: ReturnType<typeof spawn> | null = null;
let audioSubscriptionBuffer = "";
let audioSubscriptionRefreshTimer: ReturnType<typeof setTimeout> | null = null;
let audioSubscriptionRestartTimer: ReturnType<typeof setTimeout> | null = null;

const audioOutputsRefreshIntervalMs = 2000;
const audioSubscriptionDebounceMs = 75;
const audioSubscriptionRestartDelayMs = 1000;

const defaultAudioConfig: Record<string, any> = {
    alert: {
        default_volume: 0.8,
        min_range: 0,
        max_range: 1,
        steps_range: 0.01,
        pipewire_sink: true,
    },
    tts: {
        default_volume: 0.12,
        min_range: 0,
        max_range: 1,
        steps_range: 0.01,
        pipewire_sink: true,
    },
    music: {
        default_volume: 0.25,
        min_range: 0,
        max_range: 1,
        steps_range: 0.01,
        pipewire_sink: true,
    },
};

const pipewireLoopbackModuleIds: Record<string, string[]> = {};
const pipewireLoopbackSinkInputIds: Record<string, string[]> = {};
const pipewireSetupPromises: Record<string, Promise<void> | undefined> = {};
const audioVolumeWriteGeneration: Record<string, number> = {};

type PipewireLoopbackModule = {
    moduleId: string;
    outputName: string | null;
};

function getAudioConfigWithDefaults(): Record<string, any> {
    const config = getConfig(/audio /g, true) ?? {};
    const mergedConfig: Record<string, any> = {};

    for (const key in defaultAudioConfig) {
        mergedConfig[key] = {
            ...defaultAudioConfig[key],
            ...(config[key] ?? {}),
        };
    }

    for (const key in config) {
        if (mergedConfig[key]) continue;

        mergedConfig[key] = config[key];
    }

    return mergedConfig;
}

export async function initAudio() {
    const config = getAudioConfigWithDefaults();
    const savedVolumes = loadSavedAudioVolumes();

    audioPresets = loadAudioPresets();
    audioData = {};

    // Resolve the system default sink once for this init pass. It is only
    // used as a fallback for PipeWire interfaces without linked_output(s).
    const defaultOutputName = await getDefaultAudioSinkName();

    const initTasks = Object.keys(config).map(async key => {
        let linkedOutputs = normalizeLinkedOutputs(
            savedVolumes[key]?.linked_outputs ??
            savedVolumes[key]?.linked_output ??
            config[key]?.linked_outputs ??
            config[key]?.linked_output ??
            null,
        );

        if (
            isEnabled(config[key]?.pipewire_sink) &&
            linkedOutputs.length === 0 &&
            defaultOutputName &&
            !isStreambotAudioSink(defaultOutputName)
        ) {
            linkedOutputs = [defaultOutputName];
            logRegular(
                `no linked audio output configured for ${key}, using default output ${defaultOutputName}`
            );
        }

        const savedVolume = Number(savedVolumes[key]?.current_volume);
        const volume = Number.isFinite(savedVolume)
            ? normalizeVolume(savedVolume)
            : normalizeVolume(Number(config[key]?.default_volume ?? 0.2));
        const muted = savedVolumes[key]?.muted === true;
        const outputVolume = muted ? 0 : volume;

        audioData[key] = {
            ...config[key],
            current_volume: volume,
            muted,
            linked_outputs: linkedOutputs,
            linked_output: linkedOutputs[0] ?? null,
        };

        if (isEnabled(audioData[key].pipewire_sink)) {
            await initializePipewireAudioSink(key, linkedOutputs, outputVolume);
            return;
        }

        await setVolume(key, outputVolume, false, false);
    });

    await Promise.all(initTasks);

    // Persist fallback/default links as well, so next startup can reuse them.
    saveAudioVolumes();
    await sendAudioUpdate();
    notifyAudioPresetsUpdate();
    startAudioSystemSubscription();
}

async function initializePipewireAudioSink(
    key: string,
    linkedOutputs: string[],
    volume: number,
): Promise<void> {
    await setupPipewireAudioSink(key, linkedOutputs, true);
    await setPipewireSinkOutputVolume(key, volume);

    // PipeWire sometimes creates the loopback sink-input a little later.
    // Force the configured volume again shortly after setup so late inputs do not stay at 0%.
    await forcePipewireSinkOutputVolumeWithRetry(key, volume);

    const sinkVolume = await getPipewireSinkOutputVolume(key);
    applyAudioVolumeState(key, sinkVolume ?? volume);
}

async function triggerAudioEvent(
    configName: string,
    payload: Record<string, any>,
): Promise<void> {
    await triggerConfiguredEvent(configName, {
        ...payload,
        audio: audioData,
        audio_outputs: audioOutputs,
    });
}

export async function setVolume(
    audioInterface: string,
    volume: number,
    sendUpdate = true,
    saveUpdate = true,
) {
    const currentAudioData = audioData[audioInterface];

    if (!currentAudioData) return;

    const previousVolume = Number(currentAudioData.current_volume ?? 0);
    const previousMuted = currentAudioData.muted === true;
    const safeVolume = normalizeVolume(volume);
    const generation = (audioVolumeWriteGeneration[audioInterface] ?? 0) + 1;

    audioVolumeWriteGeneration[audioInterface] = generation;

    // Update the in-memory state immediately. The UI should follow the user's
    // slider, not a slower pactl readback from an older request.
    applyAudioVolumeState(audioInterface, safeVolume);

    if (saveUpdate) {
        saveAudioVolumes();
    }

    if (sendUpdate) {
        getWebsocketServer().send("notify_audio_update", audioData);
    }

    if (isEnabled(currentAudioData.pipewire_sink)) {
        await setPipewireSinkOutputVolume(audioInterface, safeVolume);
    } else if (currentAudioData.command) {
        try {
            await execute(`${currentAudioData.command} ${safeVolume}`);
        } catch (error) {
            logWarn(`setting volume for ${audioInterface} failed:`);
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        }
    }

    // A newer slider write happened while this one was in flight. Do not let
    // this older request emit events/state based on stale data.
    if (audioVolumeWriteGeneration[audioInterface] !== generation) {
        return;
    }

    if (!sendUpdate) return;

    const nextAudioData = audioData[audioInterface];
    const nextVolume = Number(nextAudioData?.current_volume ?? safeVolume);
    const nextMuted = nextAudioData?.muted === true;
    const eventPayload = {
        audio_interface: audioInterface,
        interface: audioInterface,
        previous_volume: previousVolume,
        volume: nextVolume,
        previous_muted: previousMuted,
        muted: nextMuted,
        audio_interface_data: nextAudioData,
    };

    await triggerAudioEvent("event_audio_volume", eventPayload);

    if (!previousMuted && nextMuted) {
        await triggerAudioEvent("event_audio_mute", eventPayload);
    } else if (previousMuted && !nextMuted) {
        await triggerAudioEvent("event_audio_unmute", eventPayload);
    }
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

    await setupPipewireAudioSink(audioInterface, linkedOutputs, false);
    await setPipewireSinkOutputVolume(audioInterface, wantedVolume);

    applyAudioVolumeState(audioInterface, wantedVolume);
    saveAudioVolumes();

    // Push the configured state immediately; refresh physical-output metadata
    // asynchronously because pactl enumeration is comparatively expensive.
    getWebsocketServer().send("notify_audio_update", audioData);
    void sendAudioUpdate(true);

    await triggerAudioEvent("event_audio_output_link", {
        audio_interface: audioInterface,
        interface: audioInterface,
        output: output.name,
        outputs: linkedOutputs,
        audio_interface_data: audioData[audioInterface],
    });

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

    await setupPipewireAudioSink(audioInterface, linkedOutputs, false);
    await setPipewireSinkOutputVolume(audioInterface, wantedVolume);

    applyAudioVolumeState(audioInterface, wantedVolume);
    saveAudioVolumes();

    // Push the configured state immediately; refresh physical-output metadata
    // asynchronously because pactl enumeration is comparatively expensive.
    getWebsocketServer().send("notify_audio_update", audioData);
    void sendAudioUpdate(true);

    await triggerAudioEvent("event_audio_output_unlink", {
        audio_interface: audioInterface,
        interface: audioInterface,
        output: outputName,
        outputs: linkedOutputs,
        audio_interface_data: audioData[audioInterface],
    });

    return {
        unlinked: true,
        interface: audioInterface,
        output: outputName,
        outputs: linkedOutputs,
    };
}


export async function setAudioOutputVolume(
    outputName: string,
    volume: number,
) {
    if (!outputName) return { error: "missing output" };

    const outputs = await getAvailableAudioOutputs();
    const output = outputs.find(item => item.name === outputName || item.id === outputName);

    if (!output) return { error: "unknown output" };

    const safeVolume = normalizeVolume(volume);

    try {
        await runCommand("pactl", [
            "set-sink-volume",
            output.name,
            `${Math.round(safeVolume * 100)}%`,
        ]);
    } catch (error) {
        logWarn(`setting output volume for ${output.name} failed:`);
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        return { error: "setting output volume failed" };
    }

    await refreshAudioOutputs(true);
    getWebsocketServer().send("notify_audio_outputs_update", audioOutputs);

    const updatedOutput = audioOutputs.find(item => item.name === output.name) ?? output;

    await triggerAudioEvent("event_audio_output_volume", {
        output: output.name,
        output_data: updatedOutput,
        volume: safeVolume,
    });

    return {
        output: output.name,
        volume: safeVolume,
    };
}


type AudioPreset = {
    name: string;
    volumes?: Record<string, number>;
    outputs?: Record<string, string[]>;
};

function loadAudioPresets(): Record<string, AudioPreset> {
    if (!existsSync(audioPresetSavePath)) return {};

    try {
        const parsed = JSON.parse(readFileSync(audioPresetSavePath, "utf8"));

        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return {};
        }

        return parsed;
    } catch (error) {
        logWarn("loading audio presets failed:");
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        return {};
    }
}

function saveAudioPresetsFile() {
    try {
        writeFileSync(audioPresetSavePath, JSON.stringify(audioPresets, null, 4));
    } catch (error) {
        logWarn("saving audio presets failed:");
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
}

export function getAudioPresets(): Record<string, AudioPreset> {
    if (!audioPresets || typeof audioPresets !== "object") {
        audioPresets = loadAudioPresets();
    }

    return audioPresets;
}

export function notifyAudioPresetsUpdate() {
    getWebsocketServer()?.send("notify_audio_presets_update", {
        presets: getAudioPresets(),
    });
}

export async function saveAudioPreset(
    name: string,
    includeVolumes = true,
    includeOutputs = false,
    volumeInterfaces: string[] = [],
    outputInterfaces: string[] = [],
    outputMappings: Record<string, string[]> | null = null,
) {
    const presetName = String(name ?? "").trim();

    if (!presetName) return {error: "missing preset name"};
    if (!includeVolumes && !includeOutputs) return {error: "preset is empty"};

    const preset: AudioPreset = {
        name: presetName,
    };

    if (includeVolumes) {
        preset.volumes = {};

        const selectedVolumeInterfaces = volumeInterfaces.length > 0
            ? Array.from(new Set(volumeInterfaces.map(value => String(value).trim()).filter(Boolean)))
            : Object.keys(audioData);

        for (const key of selectedVolumeInterfaces) {
            if (!audioData[key]) continue;

            const volume = Number(audioData[key]?.current_volume);

            if (Number.isFinite(volume)) {
                preset.volumes[key] = normalizeVolume(volume);
            }
        }
    }

    if (includeOutputs) {
        preset.outputs = {};

        const selectedOutputInterfaces = outputInterfaces.length > 0
            ? Array.from(new Set(outputInterfaces.map(value => String(value).trim()).filter(Boolean)))
            : Object.keys(audioData);

        for (const key of selectedOutputInterfaces) {
            if (!audioData[key] || !isEnabled(audioData[key]?.pipewire_sink)) continue;

            preset.outputs[key] = outputMappings && Array.isArray(outputMappings[key])
                ? normalizeLinkedOutputs(outputMappings[key])
                : normalizeLinkedOutputs(
                    audioData[key]?.linked_outputs ??
                    audioData[key]?.linked_output ??
                    [],
                );
        }
    }

    audioPresets[presetName] = preset;
    saveAudioPresetsFile();
    notifyAudioPresetsUpdate();

    return {
        saved: true,
        preset,
    };
}

export async function deleteAudioPreset(name: string) {
    const presetName = String(name ?? "").trim();

    if (!presetName) return {error: "missing preset name"};
    if (!audioPresets[presetName]) return {error: "unknown preset"};

    delete audioPresets[presetName];
    saveAudioPresetsFile();
    notifyAudioPresetsUpdate();

    return {
        deleted: true,
        name: presetName,
    };
}

export async function applyAudioPreset(name: string) {
    const presetName = String(name ?? "").trim();
    const preset = audioPresets[presetName];

    if (!preset) return {error: "unknown preset"};

    const interfaces = new Set<string>([
        ...Object.keys(preset.outputs ?? {}),
        ...Object.keys(preset.volumes ?? {}),
    ]);

    await Promise.all(
        Array.from(interfaces).map(async key => {
            const current = audioData[key];

            if (!current) return;

            const presetOutputs = preset.outputs?.[key];

            if (Array.isArray(presetOutputs) && isEnabled(current.pipewire_sink)) {
                const linkedOutputs = normalizeLinkedOutputs(presetOutputs);

                current.linked_outputs = linkedOutputs;
                current.linked_output = linkedOutputs[0] ?? null;
                audioData[key] = current;

                await setupPipewireAudioSink(key, linkedOutputs, false);
            }

            const presetVolume = Number(preset.volumes?.[key]);

            if (Number.isFinite(presetVolume)) {
                await setVolume(key, normalizeVolume(presetVolume), false, false);
            }
        })
    );

    saveAudioVolumes();

    // Send the new mixer state immediately. Output enumeration can update
    // asynchronously because route application is already complete.
    getWebsocketServer().send("notify_audio_update", audioData);
    void sendAudioUpdate(true);

    return {
        applied: true,
        name: presetName,
    };
}

function applyAudioVolumeState(audioInterface: string, volume: number) {
    const currentAudioData = audioData[audioInterface];

    if (!currentAudioData) return;

    const safeVolume = normalizeVolume(volume);
    const wasMuted = currentAudioData.muted === true;
    const previousVolume = Number(currentAudioData.current_volume ?? 0);

    if (safeVolume === 0) {
        if (!wasMuted) {
            logRegular(`mute ${audioInterface}`);
        }

        currentAudioData.muted = true;

        // Keep the last useful volume while muted so unmute can restore it.
        if (!Number.isFinite(previousVolume)) {
            currentAudioData.current_volume = Number(currentAudioData.min_range ?? 0);
        }
    } else {
        if (wasMuted || !volumesEqual(previousVolume, safeVolume)) {
            logRegular(`set volume for ${audioInterface} to ${safeVolume}`);
        }

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

function normalizeVolumeForInterface(audioInterface: string, volume: number): number {
    const currentAudioData = audioData[audioInterface] ?? {};
    const min = Number(currentAudioData.min_range ?? 0);
    const max = Number(currentAudioData.max_range ?? 1);
    const step = Number(currentAudioData.steps_range ?? 0.01);

    const safeMin = Number.isFinite(min) ? min : 0;
    const safeMax = Number.isFinite(max) ? max : 1;
    const clamped = Math.max(safeMin, Math.min(safeMax, normalizeVolume(volume)));

    if (!Number.isFinite(step) || step <= 0) {
        return clamped;
    }

    const stepped = safeMin + Math.round((clamped - safeMin) / step) * step;

    // Avoid normal floating point artifacts such as 0.7500000000000001.
    return Math.max(
        safeMin,
        Math.min(safeMax, Number(stepped.toFixed(6))),
    );
}

function volumesEqual(left: number, right: number): boolean {
    return Math.abs(Number(left) - Number(right)) < 0.000001;
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


function startAudioSystemSubscription() {
    if (audioSubscriptionProcess && !audioSubscriptionProcess.killed) {
        return;
    }

    if (audioSubscriptionRestartTimer) {
        clearTimeout(audioSubscriptionRestartTimer);
        audioSubscriptionRestartTimer = null;
    }

    audioSubscriptionBuffer = "";

    const subscription = spawn("pactl", ["subscribe"], {
        stdio: ["ignore", "pipe", "pipe"],
    });

    audioSubscriptionProcess = subscription;

    subscription.stdout.on("data", chunk => {
        audioSubscriptionBuffer += chunk.toString();

        const lines = audioSubscriptionBuffer.split(/\r?\n/);
        audioSubscriptionBuffer = lines.pop() ?? "";

        for (const line of lines) {
            handleAudioSystemSubscriptionEvent(line);
        }
    });

    subscription.stderr.on("data", chunk => {
        const message = chunk.toString().trim();
        if (message) {
            logWarn(`pactl subscribe: ${message}`);
        }
    });

    subscription.on("error", error => {
        logWarn("starting pactl audio subscription failed:");
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
    });

    subscription.on("close", () => {
        if (audioSubscriptionProcess === subscription) {
            audioSubscriptionProcess = null;
        }

        scheduleAudioSystemSubscriptionRestart();
    });
}

function handleAudioSystemSubscriptionEvent(line: string) {
    const event = line.trim();

    if (!event) return;

    // sink:
    //   Physical output volume/mute/default-output changes.
    //
    // sink-input:
    //   Volume/mute changes of the streambot loopbacks.
    //
    // server:
    //   Default sink changes.
    if (
        !/\bon sink #/i.test(event) &&
        !/\bon sink-input #/i.test(event) &&
        !/\bon server\b/i.test(event)
    ) {
        return;
    }

    scheduleAudioSystemRefresh();
}

function scheduleAudioSystemRefresh() {
    if (audioSubscriptionRefreshTimer) {
        clearTimeout(audioSubscriptionRefreshTimer);
    }

    audioSubscriptionRefreshTimer = setTimeout(() => {
        audioSubscriptionRefreshTimer = null;

        // Force physical-output enumeration because the normal refresh has a
        // short cache. This makes pulsemixer/media-key changes visible in the
        // websocket state immediately.
        void sendAudioUpdate(true);
    }, audioSubscriptionDebounceMs);
}

function scheduleAudioSystemSubscriptionRestart() {
    if (audioSubscriptionRestartTimer) return;

    audioSubscriptionRestartTimer = setTimeout(() => {
        audioSubscriptionRestartTimer = null;
        startAudioSystemSubscription();
    }, audioSubscriptionRestartDelayMs);
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
    await Promise.all([
        refreshPipewireSinkVolumes(),
        refreshAudioOutputs(forceAudioOutputs),
    ]);

    await updateMusicVolumeFromAudio(audioData);

    getWebsocketServer().send("notify_audio_update", audioData);
    getWebsocketServer().send("notify_audio_outputs_update", audioOutputs);
}

async function refreshPipewireSinkVolumes() {
    let changed = false;

    await Promise.all(
        Object.keys(audioData).map(async key => {
            if (!isEnabled(audioData[key].pipewire_sink)) return;

            const rawVolume = await getPipewireSinkOutputVolume(key);
            if (rawVolume === null) return;

            const currentAudioData = audioData[key];
            const currentVolume = Number(currentAudioData.current_volume ?? 0);
            const currentMuted = currentAudioData.muted === true;
            const nextMuted = rawVolume <= 0;

            // A muted interface intentionally keeps its previous non-zero
            // current_volume so unmute can restore it. Therefore a PipeWire
            // readback of 0 while already muted is NOT a volume change.
            if (nextMuted) {
                if (!currentMuted) {
                    applyAudioVolumeState(key, 0);
                    changed = true;
                }

                return;
            }

            const steppedVolume = normalizeVolumeForInterface(key, rawVolume);

            // External tools such as pulsemixer/media keys can write arbitrary
            // percentages. Keep the actual PipeWire value on the configured
            // slider grid as well, e.g. 0.77 -> 0.75 for a 0.05 step.
            if (!volumesEqual(rawVolume, steppedVolume)) {
                await setPipewireSinkOutputVolume(key, steppedVolume);
            }

            if (currentMuted || !volumesEqual(currentVolume, steppedVolume)) {
                applyAudioVolumeState(key, steppedVolume);
                changed = true;
            }
        })
    );

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
    stabilize = false,
) {
    // Multiple UI/startup calls for the same virtual sink can overlap.
    // Serialize only per interface so alert/tts/music still wire in parallel,
    // while a single interface can never race itself and create duplicate
    // module-loopback instances.
    const previous = pipewireSetupPromises[configName] ?? Promise.resolve();

    const current = previous
        .catch(() => undefined)
        .then(() => setupPipewireAudioSinkInternal(configName, outputNames, stabilize));

    pipewireSetupPromises[configName] = current;

    try {
        await current;
    } finally {
        if (pipewireSetupPromises[configName] === current) {
            delete pipewireSetupPromises[configName];
        }
    }
}

async function setupPipewireAudioSinkInternal(
    configName: string,
    outputNames: string[] | string | null,
    stabilize: boolean,
) {
    const sinkName = getStreambotSinkName(configName);
    const linkedOutputs = normalizeLinkedOutputs(outputNames);

    await ensurePipewireAudioSink(sinkName);

    // Once the virtual sink exists, checking/restoring its state and scanning
    // existing loopbacks are independent operations.
    const [, existingLoopbacks] = await Promise.all([
        stabilize
            ? forcePipewireSinkAliveWithRetry(sinkName)
            : forcePipewireSinkAlive(sinkName),
        getExistingPipewireLoopbackModules(configName),
    ]);

    const keptModuleIds: string[] = [];

    // Important: an empty linked_outputs array means explicitly disconnected.
    // Do NOT translate it to [null], because null tells module-loopback to use
    // the current default/main output.
    const wantedOutputs: (string | null)[] = [...linkedOutputs];
    const wantedKeys = new Set(
        wantedOutputs.map(outputName => getPipewireLoopbackTargetKey(outputName))
    );
    const usedKeys = new Set<string>();
    const modulesToUnload: string[] = [];

    for (const loopback of existingLoopbacks) {
        const targetKey = getPipewireLoopbackTargetKey(loopback.outputName);

        if (!wantedKeys.has(targetKey) || usedKeys.has(targetKey)) {
            modulesToUnload.push(loopback.moduleId);
            continue;
        }

        usedKeys.add(targetKey);
        keptModuleIds.push(loopback.moduleId);
    }

    await Promise.all(
        modulesToUnload.map(async moduleId => {
            try {
                await runCommand("pactl", ["unload-module", moduleId]);
            } catch {}
        })
    );

    const missingOutputs = wantedOutputs.filter(outputName =>
        !usedKeys.has(getPipewireLoopbackTargetKey(outputName))
    );

    const createdModuleIds = await Promise.all(
        missingOutputs.map(outputName =>
            loadPipewireLoopback(configName, sinkName, outputName)
        )
    );

    pipewireLoopbackModuleIds[configName] = Array.from(new Set([
        ...keptModuleIds,
        ...createdModuleIds.filter((moduleId): moduleId is string => Boolean(moduleId)),
    ]));

    if (wantedOutputs.length === 0) {
        pipewireLoopbackSinkInputIds[configName] = [];
        await forcePipewireSinkAlive(sinkName);
        return;
    }

    await sleep(25);

    pipewireLoopbackSinkInputIds[configName] =
        await findPipewireLoopbackSinkInputIds(configName);

    // PipeWire/Pulse can restore the null sink state slightly after module creation.
    // Keep the virtual streambot sink itself at 100% and unmuted; per-interface volume
    // is controlled on the loopback sink-inputs instead.
    if (stabilize) {
        await forcePipewireSinkAliveWithRetry(sinkName);
    } else {
        await forcePipewireSinkAlive(sinkName);
    }
}

async function ensurePipewireAudioSink(sinkName: string): Promise<void> {
    if (await pipewireSinkExists(sinkName)) {
        return;
    }

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
    } catch (error) {
        if (await pipewireSinkExists(sinkName)) {
            return;
        }

        logWarn(`creating pipewire sink ${sinkName} failed:`);
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
}

async function pipewireSinkExists(sinkName: string): Promise<boolean> {
    try {
        const output = await runCommandWithOutput("pactl", [
            "list",
            "sinks",
            "short",
        ]);

        return output.split(/\r?\n/).some(line => {
            const name = line.trim().split(/\s+/)[1];
            return name === sinkName;
        });
    } catch {
        return false;
    }
}

async function getExistingPipewireLoopbackModules(
    configName: string,
): Promise<PipewireLoopbackModule[]> {
    const sinkName = getStreambotSinkName(configName);
    const result: PipewireLoopbackModule[] = [];

    try {
        const modules = await runCommandWithOutput("pactl", [
            "list",
            "modules",
            "short",
        ]);

        for (const line of modules.split(/\r?\n/)) {
            if (!line.includes("module-loopback")) continue;
            if (!line.includes(`source=${sinkName}.monitor`)) continue;

            const moduleId = line.trim().split(/\s+/)[0];
            if (!moduleId) continue;

            result.push({
                moduleId,
                outputName: parsePipewireLoopbackSinkName(line),
            });
        }
    } catch {}

    return result;
}

function parsePipewireLoopbackSinkName(moduleLine: string): string | null {
    const match = moduleLine.match(/(?:^|\s)sink=([^\s]+)/);
    return match?.[1]?.trim() || null;
}

function getPipewireLoopbackTargetKey(outputName: string | null): string {
    return outputName ?? "__default__";
}

async function forcePipewireSinkAlive(sinkName: string): Promise<void> {
    try {
        await runCommand("pactl", ["set-sink-mute", sinkName, "0"]);
        await runCommand("pactl", ["set-sink-volume", sinkName, "100%"]);
    } catch {}
}

async function forcePipewireSinkAliveWithRetry(
    sinkName: string,
    attempts = 12,
    delayMs = 150,
): Promise<void> {
    for (let attempt = 0; attempt < attempts; attempt++) {
        await forcePipewireSinkAlive(sinkName);

        if (attempt < attempts - 1) {
            await sleep(delayMs);
        }
    }
}

async function forcePipewireSinkInputsVolume(
    configName: string,
    sinkInputIds: string[],
    volume: number,
): Promise<void> {
    const safeVolume = normalizeVolume(volume);

    await Promise.all(sinkInputIds.map(async sinkInputId => {
        try {
            await runCommand("pactl", ["set-sink-input-mute", sinkInputId, "0"]);
            await runCommand("pactl", [
                "set-sink-input-volume",
                sinkInputId,
                `${Math.round(safeVolume * 100)}%`,
            ]);
        } catch (error) {
            logWarn(`forcing volume for ${configName} sink-input ${sinkInputId} failed:`);
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        }
    }));
}


async function forcePipewireSinkOutputVolumeWithRetry(
    configName: string,
    volume: number,
    attempts = 8,
    delayMs = 150,
): Promise<void> {
    const safeVolume = normalizeVolume(volume);

    for (let attempt = 0; attempt < attempts; attempt++) {
        const sinkInputIds = await findPipewireLoopbackSinkInputIds(configName);

        if (sinkInputIds.length > 0) {
            pipewireLoopbackSinkInputIds[configName] = sinkInputIds;
            await forcePipewireSinkInputsVolume(configName, sinkInputIds, safeVolume);
        }

        if (attempt < attempts - 1) {
            await sleep(delayMs);
        }
    }
}

async function loadPipewireLoopback(
    configName: string,
    sinkName: string,
    outputName: string | null,
): Promise<string | null> {
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

        return moduleId || null;
    } catch (error) {
        logWarn(`loading loopback for ${configName}${outputName ? ` -> ${outputName}` : ""} failed:`);
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        return null;
    }
}

export async function cleanupPipewireAudioSink(configName: string) {
    // Do not race cleanup against an in-flight setup for the same interface.
    await pipewireSetupPromises[configName]?.catch(() => undefined);

    const existingLoopbacks = await getExistingPipewireLoopbackModules(configName);
    const moduleIds = Array.from(new Set([
        ...(pipewireLoopbackModuleIds[configName] ?? []),
        ...existingLoopbacks.map(loopback => loopback.moduleId),
    ]));

    await Promise.all(moduleIds.map(async moduleId => {
        try {
            await runCommand("pactl", ["unload-module", moduleId]);
        } catch {}
    }));

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

    // Normal slider/relink operations should be quick. The heavier retry
    // loops are handled explicitly during startup initialization.
    await forcePipewireSinkAlive(getStreambotSinkName(configName));

    if (!pipewireLoopbackSinkInputIds[configName]?.length) {
        pipewireLoopbackSinkInputIds[configName] =
            await findPipewireLoopbackSinkInputIds(configName);
    }

    const sinkInputIds = pipewireLoopbackSinkInputIds[configName] ?? [];

    if (!sinkInputIds.length) {
        // A newly-created loopback can appear a fraction later. Do one short
        // retry without blocking an interactive slider for over a second.
        await sleep(40);

        pipewireLoopbackSinkInputIds[configName] =
            await findPipewireLoopbackSinkInputIds(configName);

        const retryIds = pipewireLoopbackSinkInputIds[configName] ?? [];

        if (!retryIds.length) {
            logWarn(`${getStreambotSinkName(configName)} loopback sink-input not found`);
            return;
        }

        await forcePipewireSinkInputsVolume(configName, retryIds, safeVolume);
        return;
    }

    await forcePipewireSinkInputsVolume(configName, sinkInputIds, safeVolume);
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
