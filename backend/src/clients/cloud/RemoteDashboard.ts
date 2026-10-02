import {getOBSClient, getTwitchClient, getYoloboxClient} from "../../App";
import {
    back as musicBack,
    getStatus as getMusicStatus,
    next as musicNext,
    pause as musicPause,
    play as musicPlay,
    playSong,
    setMusicLoop,
    setMusicShuffle,
    setVolume as setMusicVolume,
    togglePause as musicTogglePause,
    toggleSongRequest,
} from "../../helper/MusicHelper";
import {getGiveaway, removeGiveawayUser, startGiveaway, stopGiveaway} from "../../helper/GiveawayHelper";
import {cancelInteraction, getInteractionQueue} from "../../helper/InteractionHelper";
import {removeAlertByEventUuid} from "../../helper/AlertHelper";
import {getAutoMacros, toggleAutoMacro} from "../../helper/AutoMacroHelper";
import {getMacros, triggerMacro} from "../../helper/MacroHelper";
import {
    getChannelPointUpdatePayload,
    toggleChannelPoint,
} from "../../helper/ChannelPointHelper";
import {
    getRotateSceneRuntimeState,
    getRotateScenes,
    startRotateScene,
    stopRotateScene,
} from "../../helper/RotateSceneHelper";
import {
    applyAudioPreset,
    getAudioData,
    getAudioOutputs,
    getAudioPresets,
    setAudioOutputMute,
    setAudioOutputVolume,
} from "../../helper/AudioHelper";
import {getManagedConnections} from "../../helper/ConnectionHelper";
import {setYoloboxIntegrationEnabled} from "../../helper/IntegrationsHelper";

export const REMOTE_DASHBOARD_VERSION = 2;

function requiredString(value: unknown, name: string): string {
    const result = String(value ?? "").trim();
    if (!result) throw new Error(`${name} is required`);
    return result;
}

function booleanValue(value: unknown): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (["1", "true", "yes", "on", "enable", "enabled"].includes(normalized)) return true;
        if (["0", "false", "no", "off", "disable", "disabled"].includes(normalized)) return false;
    }
    return Boolean(value);
}

function clamp(value: unknown, min: number, max: number, name: string): number {
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error(`${name} must be a number`);
    return Math.max(min, Math.min(max, n));
}

export function getRemoteDashboardSnapshot() {
    const obs = getOBSClient();
    const yolobox = getYoloboxClient();
    const connections = getManagedConnections();

    return {
        version: REMOTE_DASHBOARD_VERSION,
        updated_at: Date.now(),
        music: getMusicStatus(),
        giveaway: getGiveaway(),
        interactions: getInteractionQueue(),
        auto_macros: getAutoMacros(),
        macros: getMacros(),
        channel_points: getChannelPointUpdatePayload(),
        rotating_scene: {
            items: getRotateScenes(),
            runtime: getRotateSceneRuntimeState(),
        },
        audio: {
            data: getAudioData(),
            outputs: getAudioOutputs(),
            presets: getAudioPresets(),
        },
        obs: {
            // Cloud snapshots can be requested while the backend is still booting.
            // OBS is initialized later in App.ts, so never assume the client exists here.
            connection_names: obs?.getConnectionNames?.() ?? [],
            connected_connections: obs?.getConnectedConnectionNames?.() ?? [],
            scenes: obs?.getAllSceneData?.() ?? {},
            audio: obs?.getAllAudioData?.() ?? {},
        },
        yolobox: {
            connection: connections.yolobox ?? null,
            // Same startup rule as OBS: an enabled cloud integration may publish a
            // snapshot before the Yolobox client has been constructed.
            ip: yolobox?.getIp?.() ?? null,
            data: yolobox?.getData?.() ?? null,
        },
        connections,
    };
}

async function getYoloboxPreview(targetValue: unknown) {
    const target = requiredString(targetValue, "target").replace(/^\/+/, "");
    if (
        /^https?:\/\//i.test(target)
        || target.includes("://")
        || target.includes("\\")
        || target.startsWith("..")
        || target.includes("../")
    ) {
        throw new Error("invalid Yolobox preview target");
    }

    const ip = requiredString(getYoloboxClient().getIp(), "Yolobox IP");
    const url = new URL(`http://${ip}:8080/`);
    const [pathPart, queryPart] = target.split("?", 2);
    url.pathname = `/${pathPart}`;
    if (queryPart) url.search = `?${queryPart}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);

    try {
        const response = await fetch(url.toString(), {signal: controller.signal});
        if (!response.ok) throw new Error(`Yolobox preview returned ${response.status}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        return {
            content_type: response.headers.get("content-type") ?? "application/octet-stream",
            etag: response.headers.get("etag") ?? undefined,
            last_modified: response.headers.get("last-modified") ?? undefined,
            base64: bytes.toString("base64"),
        };
    } finally {
        clearTimeout(timeout);
    }
}

export async function executeRemoteDashboardAction(
    action: string,
    payload: any = {},
    requestedBy?: any,
) {
    switch (action) {
        case "music.play":
            await musicPlay();
            return getMusicStatus();
        case "music.pause":
            await musicPause();
            return getMusicStatus();
        case "music.toggle_pause":
            await musicTogglePause();
            return getMusicStatus();
        case "music.next":
            await musicNext();
            return getMusicStatus();
        case "music.back":
            await musicBack();
            return getMusicStatus();
        case "music.volume":
            await setMusicVolume(clamp(payload?.volume ?? payload?.value, 0, 100, "volume"));
            return getMusicStatus();
        case "music.shuffle":
            await setMusicShuffle(booleanValue(payload?.enabled ?? payload?.state));
            return getMusicStatus();
        case "music.loop":
            await setMusicLoop(booleanValue(payload?.enabled ?? payload?.state));
            return getMusicStatus();
        case "music.song_requests.toggle":
            return {enabled: await toggleSongRequest(), music: getMusicStatus()};
        case "music.play_song":
            return {played: await playSong(payload ?? {}), music: getMusicStatus()};

        case "giveaway.start": {
            const content = requiredString(payload?.content, "content");
            const duration = clamp(payload?.duration, 1, 86_400, "duration");
            await startGiveaway(content, duration);
            return getGiveaway();
        }
        case "giveaway.stop":
            await stopGiveaway("cancelled", false);
            return getGiveaway();
        case "giveaway.remove_user": {
            const userId = requiredString(payload?.user ?? payload?.user_id ?? payload?.id, "user");
            const user = await getTwitchClient().getBot().api.users.getUserById(userId);
            if (!user) throw new Error("Twitch user not found");
            await removeGiveawayUser(user);
            return getGiveaway();
        }

        case "interaction.remove": {
            const uuid = requiredString(payload?.uuid ?? payload?.eventUuid ?? payload?.["event-uuid"], "uuid");
            removeAlertByEventUuid(uuid);
            return {removed: cancelInteraction(uuid), interactions: getInteractionQueue()};
        }

        case "auto_macro.toggle": {
            const name = requiredString(payload?.name ?? payload?.id, "name");
            const enabled = booleanValue(payload?.enabled ?? payload?.enable);
            toggleAutoMacro(name, enabled);
            return getAutoMacros();
        }

        case "macro.run": {
            const macro = requiredString(payload?.id ?? payload?.macro ?? payload?.name, "macro id");
            return triggerMacro(macro, {
                ...(payload?.variables && typeof payload.variables === "object" ? payload.variables : {}),
                cloud_requested_by: requestedBy ?? null,
            });
        }

        case "channel_point.toggle": {
            const channelPoint = payload?.channel_point ?? payload?.channelPoint;
            if (!channelPoint?.name) throw new Error("channel_point.name is required");
            const state = String(payload?.state ?? "toggle").trim().toLowerCase();
            if (["enable", "true"].includes(state)) await toggleChannelPoint(channelPoint, false);
            else if (["disable", "false"].includes(state)) await toggleChannelPoint(channelPoint, true);
            else if (state === "toggle") await toggleChannelPoint(channelPoint, !channelPoint.active);
            else throw new Error("invalid channel point state");
            return getChannelPointUpdatePayload();
        }

        case "rotating_scene.start": {
            const name = requiredString(payload?.name ?? payload?.scene ?? payload?.id, "name");
            return {
                started: await startRotateScene(name),
                items: getRotateScenes(),
                runtime: getRotateSceneRuntimeState(),
            };
        }
        case "rotating_scene.stop":
            stopRotateScene();
            return {items: getRotateScenes(), runtime: getRotateSceneRuntimeState()};

        case "audio.output.volume": {
            const output = requiredString(payload?.output, "output");
            const volume = clamp(payload?.volume, 0, 100, "volume");
            return setAudioOutputVolume(output, volume);
        }
        case "audio.output.mute": {
            const output = requiredString(payload?.output, "output");
            return setAudioOutputMute(output, booleanValue(payload?.muted));
        }
        case "audio.preset.apply":
            return applyAudioPreset(requiredString(payload?.name, "name"));

        case "obs.scene": {
            const connection = String(payload?.connection ?? payload?.obs_id ?? "default");
            if (payload?.sceneUuid) {
                await getOBSClient().send("SetCurrentProgramScene", {sceneUuid: payload.sceneUuid}, connection);
            } else {
                const sceneName = requiredString(payload?.sceneName ?? payload?.scene, "sceneName");
                await getOBSClient().send("SetCurrentProgramScene", {sceneName}, connection);
            }
            return {connection, scenes: getOBSClient().getSceneData(connection)};
        }
        case "obs.command": {
            const method = requiredString(payload?.method, "method");
            const connection = String(payload?.connection ?? payload?.obs_id ?? "default");
            await getOBSClient().send(method, payload?.data ?? {}, connection);
            return {status: "okay", connection};
        }

        case "yolobox.execute": {
            if (!payload?.orderID) throw new Error("orderID is required");
            if (!payload?.data) throw new Error("data is required");
            getYoloboxClient().sendCommand(payload);
            return getYoloboxClient().getData();
        }
        case "yolobox.toggle": {
            const enabled = booleanValue(payload?.enabled ?? payload?.enable);
            setYoloboxIntegrationEnabled(enabled);
            if (enabled) await getYoloboxClient().connect();
            else getYoloboxClient().disconnect();
            return {enabled, data: getYoloboxClient().getData()};
        }
        case "yolobox.preview":
            return getYoloboxPreview(payload?.target);

        default:
            throw new Error(`unsupported cloud dashboard action: ${action}`);
    }
}
