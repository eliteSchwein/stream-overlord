import parseConfig from "js-conf-parser";
import TwitchClient from "../clients/twitch/Client";
import {logError, logNotice, logRegular, logWarn} from "./LogHelper";
import {existsSync, mkdirSync, readFileSync, watchFile, writeFileSync} from "node:fs";
import getWebsocketServer, {reload} from "../App";
import * as path from "node:path";
import * as os from "node:os";

let config: any = {};
let primaryChannel: any = undefined;
let configWatcherRegistered = false;
let reloadTimer: NodeJS.Timeout | undefined;

export type AssetTuneCodec = "vp9" | "av1";

export type AssetTuneSettings = {
    ffmpeg_bin: string;
    ffprobe_bin: string;
    codec: AssetTuneCodec;
    auto_compress_upload: boolean;
    image_compress_level: number;
    image_compress_percent: number;
    audio_bitrate: string;
    disable_nv: boolean;
    disable_amf: boolean;
    disable_qsv: boolean;
    disable_vaapi: boolean;
};

export type TtsSettings = {
    enabled: boolean;
    voices: Record<string, string[]>;
};

export type ThemeSettings = {
    default_color: string;
};

export type CategoryLibraryMediaSlot = {
    name: string;
    target?: string;
    orientation: "horizontal" | "vertical" | "any";
    autoplay: boolean;
    loop: boolean;
    muted: boolean;
};

export type CategoryLibrarySettings = {
    enabled: boolean;
    auto_create: boolean;
    fetch_cover: boolean;
    fetch_steam_wallpaper: boolean;
    auto_theme_color: boolean;
    apply_theme_color: boolean;
    apply_media: boolean;
    apply_custom_css: boolean;
    apply_obs_filters: boolean;
    apply_channel_points: boolean;
    media_slots: CategoryLibraryMediaSlot[];
};

export type VirtualAudioCableSettings = {
    id: string;
    name: string;
    enabled: boolean;
    /** Audio interfaces routed to this cable, e.g. alert/tts/music. */
    channels?: string[];
};

const defaultVirtualAudioCableChannels = ["alert", "tts", "music"];

export type GiveawaySettings = {
    giveawayCommand: string;
    progress_interval_seconds: number;
    require_follower: boolean;
    minimum_follow_seconds: number;
    require_subscriber: boolean;
    require_vip: boolean;
    require_moderator: boolean;
};

export type CavaTargetSettings = Record<string, string | number | boolean>;

export type CavaSettings = {
    bars: number;
    input: {
        source: string;
    };
    output: {
        channels: string;
    };
    targets: Record<string, CavaTargetSettings>;
};

type StreambotSettings = {
    language: string;
    touch_wallpaper: string;
    asset_tune: AssetTuneSettings;
    tts: TtsSettings;
    theme: ThemeSettings;
    cava: CavaSettings;
    giveaway: GiveawaySettings;
    category_library: CategoryLibrarySettings;
    virtual_audio_cables: VirtualAudioCableSettings[];
};

const defaultAssetTuneSettings: AssetTuneSettings = {
    ffmpeg_bin: "ffmpeg",
    ffprobe_bin: "ffprobe",
    codec: "vp9",
    auto_compress_upload: false,
    image_compress_level: 6,
    image_compress_percent: 80,
    audio_bitrate: "128k",
    disable_nv: false,
    disable_amf: false,
    disable_qsv: false,
    disable_vaapi: false,
};

const defaultTtsSettings: TtsSettings = {
    enabled: false,
    voices: {},
};

const defaultThemeSettings: ThemeSettings = {
    default_color: "ff9800",
};

const defaultCategoryLibrarySettings: CategoryLibrarySettings = {
    enabled: false,
    auto_create: true,
    fetch_cover: true,
    fetch_steam_wallpaper: true,
    auto_theme_color: true,
    apply_theme_color: true,
    apply_media: true,
    apply_custom_css: true,
    apply_obs_filters: true,
    apply_channel_points: true,
    media_slots: [
        {name: "horizontal", target: "horizontal", orientation: "horizontal", autoplay: true, loop: true, muted: true},
        {name: "vertical", target: "vertical", orientation: "vertical", autoplay: true, loop: true, muted: true},
    ],
};

const defaultVirtualAudioCableSettings: VirtualAudioCableSettings[] = [
    {
        id: "overlay",
        name: "Streambot Overlay Cable",
        enabled: true,
        channels: [...defaultVirtualAudioCableChannels],
    },
];

const defaultGiveawaySettings: GiveawaySettings = {
    giveawayCommand: "ticket",
    progress_interval_seconds: 60,
    require_follower: false,
    minimum_follow_seconds: 0,
    require_subscriber: false,
    require_vip: false,
    require_moderator: false,
};

const defaultCavaSettings: CavaSettings = {
    bars: 36,
    input: {
        source: "streambot_cava.monitor",
    },
    output: {
        channels: "mono",
    },
    targets: {},
};

let systemConfig: StreambotSettings = {
    language: "en",
    touch_wallpaper: "",
    asset_tune: defaultAssetTuneSettings,
    tts: defaultTtsSettings,
    theme: defaultThemeSettings,
    cava: defaultCavaSettings,
    giveaway: defaultGiveawaySettings,
    category_library: defaultCategoryLibrarySettings,
    virtual_audio_cables: defaultVirtualAudioCableSettings,
};

const systemConfigDir = path.resolve(os.homedir(), ".config/streambot");
const systemConfigPath = path.resolve(systemConfigDir, "streambot-settings.json");

function ensureSystemConfigDir() {
    mkdirSync(systemConfigDir, {recursive: true});
}

function serializeSystemConfig(configToSerialize: StreambotSettings) {
    return `${JSON.stringify(configToSerialize, null, 2)}\n`;
}

export function getSystemConfigDirectory() {
    return systemConfigDir;
}

function writeSystemConfigFile(configToWrite: StreambotSettings) {
    ensureSystemConfigDir();

    const content = serializeSystemConfig(configToWrite);

    if (existsSync(systemConfigPath)) {
        try {
            if (readFileSync(systemConfigPath, "utf8") === content) {
                return;
            }
        } catch {
            // If reading fails, fall through and try to write the normalized config.
        }
    }

    writeFileSync(systemConfigPath, content, "utf8");
}

function scheduleReload() {
    if (reloadTimer) {
        clearTimeout(reloadTimer);
    }

    reloadTimer = setTimeout(async () => {
        reloadTimer = undefined;
        await reload();
    }, 250);
}

function sameValue(left: unknown, right: unknown) {
    return JSON.stringify(left) === JSON.stringify(right);
}

function hasNonTtsChanges(previous: StreambotSettings, next: StreambotSettings) {
    const {
        tts: _previousTts,
        touch_wallpaper: _previousTouchWallpaper,
        virtual_audio_cables: _previousVirtualAudioCables,
        ...previousReloadSettings
    } = previous;
    const {
        tts: _nextTts,
        touch_wallpaper: _nextTouchWallpaper,
        virtual_audio_cables: _nextVirtualAudioCables,
        ...nextReloadSettings
    } = next;

    return !sameValue(previousReloadSettings, nextReloadSettings);
}

function applyTtsSettingsChange(previous: TtsSettings, next: TtsSettings) {
    if (sameValue(previous, next)) return;

    void import("./TTShelper")
        .then(async ({installTts, purgeTts, syncConfiguredVoices}) => {
            // Installing/purging is tied only to the enabled toggle changing.
            if (previous.enabled !== next.enabled) {
                if (next.enabled) {
                    await installTts();
                    await syncConfiguredVoices();
                } else {
                    await purgeTts();
                }
                return;
            }

            // Voice changes are hot-applied, but never install Piper on their own.
            if (next.enabled && !sameValue(previous.voices, next.voices)) {
                await syncConfiguredVoices();
            }
        })
        .catch((error: any) => {
            logWarn(`failed to apply TTS settings: ${error?.message ?? error}`);
        });
}

function handleSystemConfigChange(previous: StreambotSettings, next: StreambotSettings) {
    applyTtsSettingsChange(previous.tts, next.tts);

    if (hasNonTtsChanges(previous, next)) {
        scheduleReload();
    }
}

function normalizeAssetTuneSettings(rawAssetTuneSettings: Partial<AssetTuneSettings> = {}): AssetTuneSettings {
    const codec = String(rawAssetTuneSettings.codec || defaultAssetTuneSettings.codec)
        .trim()
        .toLowerCase();

    return {
        ffmpeg_bin: stringSetting(rawAssetTuneSettings.ffmpeg_bin, defaultAssetTuneSettings.ffmpeg_bin),
        ffprobe_bin: stringSetting(rawAssetTuneSettings.ffprobe_bin, defaultAssetTuneSettings.ffprobe_bin),
        codec: codec === "av1" ? "av1" : "vp9",
        auto_compress_upload: booleanSetting(rawAssetTuneSettings.auto_compress_upload, defaultAssetTuneSettings.auto_compress_upload),
        image_compress_level: numberSetting(rawAssetTuneSettings.image_compress_level, defaultAssetTuneSettings.image_compress_level),
        image_compress_percent: numberSetting(rawAssetTuneSettings.image_compress_percent, defaultAssetTuneSettings.image_compress_percent),
        audio_bitrate: stringSetting(rawAssetTuneSettings.audio_bitrate, defaultAssetTuneSettings.audio_bitrate),
        disable_nv: booleanSetting(rawAssetTuneSettings.disable_nv, defaultAssetTuneSettings.disable_nv),
        disable_amf: booleanSetting(rawAssetTuneSettings.disable_amf, defaultAssetTuneSettings.disable_amf),
        disable_qsv: booleanSetting(rawAssetTuneSettings.disable_qsv, defaultAssetTuneSettings.disable_qsv),
        disable_vaapi: booleanSetting(rawAssetTuneSettings.disable_vaapi, defaultAssetTuneSettings.disable_vaapi),
    };
}

function normalizeTtsSettings(rawTtsSettings: Partial<TtsSettings> = {}): TtsSettings {
    const rawVoices = rawTtsSettings.voices && typeof rawTtsSettings.voices === "object" && !Array.isArray(rawTtsSettings.voices)
        ? rawTtsSettings.voices
        : {};

    const voices: Record<string, string[]> = {};

    for (const [locale, rawVoiceList] of Object.entries(rawVoices)) {
        const normalizedLocale = String(locale ?? "").trim();
        if (!normalizedLocale) continue;

        const values = Array.isArray(rawVoiceList) ? rawVoiceList : [rawVoiceList];
        const normalizedVoices = [...new Set(
            values
                .map((voice) => String(voice ?? "").trim().replace(/\.onnx$/i, ""))
                .filter(Boolean),
        )];

        if (normalizedVoices.length) {
            voices[normalizedLocale] = normalizedVoices;
        }
    }

    return {
        enabled: booleanSetting(rawTtsSettings.enabled, defaultTtsSettings.enabled),
        voices,
    };
}

function normalizeThemeSettings(rawThemeSettings: Partial<ThemeSettings> = {}): ThemeSettings {
    return {
        default_color: normalizeHexColor(rawThemeSettings.default_color, defaultThemeSettings.default_color),
    };
}


function normalizeCavaTargetSettings(rawTargetSettings: Record<string, unknown> = {}): CavaTargetSettings {
    const target: CavaTargetSettings = {};

    for (const key in rawTargetSettings) {
        const normalizedKey = String(key).trim();

        if (!normalizedKey) continue;

        const value = rawTargetSettings[key];

        if (value === undefined || value === null || value === "") continue;

        if (typeof value === "boolean" || typeof value === "number") {
            target[normalizedKey] = value;
            continue;
        }

        if (typeof value === "string") {
            const trimmed = value.trim();
            const lower = trimmed.toLowerCase();

            if (["true", "1", "yes", "on"].includes(lower)) {
                target[normalizedKey] = true;
                continue;
            }

            if (["false", "0", "no", "off"].includes(lower)) {
                target[normalizedKey] = false;
                continue;
            }

            const numericValue = Number(trimmed);

            target[normalizedKey] = Number.isFinite(numericValue) ? numericValue : trimmed;
        }
    }

    if (target.enabled === undefined) {
        target.enabled = true;
    }

    if (target.bars === undefined) {
        target.bars = defaultCavaSettings.bars;
    }

    return target;
}

function normalizeCavaSettings(rawCavaSettings: Partial<CavaSettings> = {}): CavaSettings {
    const rawTargets = rawCavaSettings.targets && typeof rawCavaSettings.targets === "object"
        ? rawCavaSettings.targets
        : {};

    const targets: Record<string, CavaTargetSettings> = {};

    for (const key in rawTargets) {
        const normalizedKey = String(key).trim();

        if (!normalizedKey) continue;

        targets[normalizedKey] = normalizeCavaTargetSettings(rawTargets[key]);
    }

    return {
        bars: numberSetting(rawCavaSettings.bars, defaultCavaSettings.bars),
        input: {
            source: stringSetting(rawCavaSettings.input?.source, defaultCavaSettings.input.source),
        },
        output: {
            channels: stringSetting(rawCavaSettings.output?.channels, defaultCavaSettings.output.channels),
        },
        targets,
    };
}

function normalizeHexColor(value: unknown, fallback: string): string {
    const raw = stringSetting(value, fallback)
        .replace(/^#/, "")
        .trim()
        .toLowerCase();

    if (/^[0-9a-f]{3}$/i.test(raw) || /^[0-9a-f]{6}$/i.test(raw)) {
        return raw;
    }

    return fallback;
}



function normalizeCategoryLibraryMediaSlots(value: unknown): CategoryLibraryMediaSlot[] {
    const source = Array.isArray(value) && value.length
        ? value
        : defaultCategoryLibrarySettings.media_slots;
    const seen = new Set<string>();
    const result: CategoryLibraryMediaSlot[] = [];

    for (const raw of source as any[]) {
        const name = String(raw?.name ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
        if (!name || seen.has(name)) continue;
        seen.add(name);

        const orientation = ["horizontal", "vertical", "any"].includes(String(raw?.orientation))
            ? raw.orientation as CategoryLibraryMediaSlot["orientation"]
            : "any";

        result.push({
            name,
            target: String(raw?.target ?? "").trim() || undefined,
            orientation,
            autoplay: raw?.autoplay !== false,
            loop: raw?.loop !== false,
            muted: raw?.muted !== false,
        });
    }

    return result.length ? result : defaultCategoryLibrarySettings.media_slots.map(slot => ({...slot}));
}

function normalizeCategoryLibrarySettings(raw: Partial<CategoryLibrarySettings> = {}): CategoryLibrarySettings {
    return {
        enabled: booleanSetting(raw.enabled, defaultCategoryLibrarySettings.enabled),
        auto_create: booleanSetting(raw.auto_create, defaultCategoryLibrarySettings.auto_create),
        fetch_cover: booleanSetting(raw.fetch_cover, defaultCategoryLibrarySettings.fetch_cover),
        fetch_steam_wallpaper: booleanSetting(raw.fetch_steam_wallpaper, defaultCategoryLibrarySettings.fetch_steam_wallpaper),
        auto_theme_color: booleanSetting(raw.auto_theme_color, defaultCategoryLibrarySettings.auto_theme_color),
        apply_theme_color: booleanSetting(raw.apply_theme_color, defaultCategoryLibrarySettings.apply_theme_color),
        apply_media: booleanSetting(raw.apply_media, defaultCategoryLibrarySettings.apply_media),
        apply_custom_css: booleanSetting(raw.apply_custom_css, defaultCategoryLibrarySettings.apply_custom_css),
        apply_obs_filters: booleanSetting((raw as any).apply_obs_filters, defaultCategoryLibrarySettings.apply_obs_filters),
        apply_channel_points: booleanSetting((raw as any).apply_channel_points, defaultCategoryLibrarySettings.apply_channel_points),
        media_slots: normalizeCategoryLibraryMediaSlots((raw as any).media_slots ?? (raw as any).custom_media),
    };
}


function normalizeVirtualAudioCableSettings(raw: unknown): VirtualAudioCableSettings[] {
    const source = Array.isArray(raw) ? raw : defaultVirtualAudioCableSettings;
    const result: VirtualAudioCableSettings[] = [];
    const used = new Set<string>();

    for (const item of source) {
        if (!item || typeof item !== "object") continue;
        const rawItem: any = item;
        const id = String(rawItem.id ?? rawItem.name ?? "")
            .trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
        if (!id || used.has(id)) continue;
        used.add(id);
        // Migration behavior: cable definitions from the first virtual-audio
        // implementation had no `channels` field. Those cables were intended
        // to carry the normal Streambot mix, so migrate a missing field to all
        // built-in audio channels. An explicitly configured [] still means
        // "route nothing".
        const channels: string[] = Array.isArray(rawItem.channels)
            ? Array.from(new Set<string>(
                rawItem.channels
                    .map((channel: unknown) => String(channel ?? "").trim())
                    .filter((channel: string) => Boolean(channel))
            ))
            : [...defaultVirtualAudioCableChannels];

        result.push({
            id,
            name: String(rawItem.name ?? id).trim() || id,
            enabled: booleanSetting(rawItem.enabled, true),
            channels,
        });
    }

    return result;
}
function normalizeGiveawaySettings(rawGiveawaySettings: Partial<GiveawaySettings> = {}): GiveawaySettings {
    const giveawayCommand = String(
        rawGiveawaySettings.giveawayCommand
        ?? (rawGiveawaySettings as any).command
        ?? defaultGiveawaySettings.giveawayCommand
    )
        .trim()
        .replace(/^!+/, "")
        .toLowerCase() || defaultGiveawaySettings.giveawayCommand;

    return {
        giveawayCommand,
        progress_interval_seconds: Math.max(0, Math.floor(numberSetting(
            rawGiveawaySettings.progress_interval_seconds,
            defaultGiveawaySettings.progress_interval_seconds,
        ))),
        require_follower: booleanSetting(rawGiveawaySettings.require_follower, defaultGiveawaySettings.require_follower),
        minimum_follow_seconds: Math.max(0, Math.floor(numberSetting(
            rawGiveawaySettings.minimum_follow_seconds,
            defaultGiveawaySettings.minimum_follow_seconds,
        ))),
        require_subscriber: booleanSetting(rawGiveawaySettings.require_subscriber, defaultGiveawaySettings.require_subscriber),
        require_vip: booleanSetting(rawGiveawaySettings.require_vip, defaultGiveawaySettings.require_vip),
        require_moderator: booleanSetting(rawGiveawaySettings.require_moderator, defaultGiveawaySettings.require_moderator),
    };
}

function normalizeSystemConfig(rawSystemConfig: Partial<StreambotSettings> = {}): StreambotSettings {
    const requestedLanguage = String(rawSystemConfig.language || "en")
        .trim()
        .toLowerCase();
    const language = requestedLanguage === "de" ? "de" : "en";

    const rawCategoryLibraryValue: any = (rawSystemConfig as any).category_library
        ?? (rawSystemConfig as any).categoryLibrary;
    const rawCategoryLibrary: Partial<CategoryLibrarySettings> = typeof rawCategoryLibraryValue === "boolean"
        ? {enabled: rawCategoryLibraryValue}
        : {
            ...(rawCategoryLibraryValue && typeof rawCategoryLibraryValue === "object" ? rawCategoryLibraryValue : {}),
            ...((rawSystemConfig as any).category_library_enabled !== undefined
                ? {enabled: (rawSystemConfig as any).category_library_enabled}
                : {}),
            ...((rawSystemConfig as any).categoryLibraryEnabled !== undefined
                ? {enabled: (rawSystemConfig as any).categoryLibraryEnabled}
                : {}),
        };

    return {
        language,
        touch_wallpaper: typeof rawSystemConfig.touch_wallpaper === "string" ? rawSystemConfig.touch_wallpaper.trim() : "",
        asset_tune: normalizeAssetTuneSettings(rawSystemConfig.asset_tune),
        tts: normalizeTtsSettings(rawSystemConfig.tts),
        theme: normalizeThemeSettings(rawSystemConfig.theme),
        cava: normalizeCavaSettings(rawSystemConfig.cava),
        giveaway: normalizeGiveawaySettings(rawSystemConfig.giveaway),
        category_library: normalizeCategoryLibrarySettings(rawCategoryLibrary),
        virtual_audio_cables: normalizeVirtualAudioCableSettings((rawSystemConfig as any).virtual_audio_cables),
    };
}

function stringSetting(value: unknown, fallback: string): string {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberSetting(value: unknown, fallback: number): number {
    const n = Number(value);

    return Number.isFinite(n) ? n : fallback;
}

function booleanSetting(value: unknown, fallback: boolean): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();

        if (["true", "1", "yes", "on"].includes(normalized)) return true;
        if (["false", "0", "no", "off"].includes(normalized)) return false;
    }

    return fallback;
}

function withSystemConfig<T extends object>(parsedConfig: T): T & { system_config: StreambotSettings } {
    return {
        ...parsedConfig,
        system_config: systemConfig
    };
}

function emitSettingsUpdate() {
    getWebsocketServer().send("notify_settings_update", getSettings());
}

export function readSystemConfig() {
    if (!existsSync(systemConfigPath)) {
        systemConfig = normalizeSystemConfig();
        writeSystemConfigFile(systemConfig);
        return systemConfig;
    }

    try {
        const raw = readFileSync(systemConfigPath, "utf8");
        const parsed = JSON.parse(raw);

        systemConfig = normalizeSystemConfig(parsed);

        // Only repair the file when a required value is missing/invalid.
        // Do not rewrite on every read, otherwise watchFile sees our own read-normalize-write
        // cycle as another change and reloads forever.
        if (serializeSystemConfig(parsed) !== serializeSystemConfig(systemConfig)) {
            writeSystemConfigFile(systemConfig);
        }
    } catch {
        systemConfig = normalizeSystemConfig();
        writeSystemConfigFile(systemConfig);
    }

    return systemConfig;
}

export function writeSystemConfig(newSystemConfig: Partial<StreambotSettings>) {
    const previousSystemConfig = systemConfig;

    systemConfig = normalizeSystemConfig({
        ...systemConfig,
        ...newSystemConfig,
        asset_tune: {
            ...systemConfig.asset_tune,
            ...newSystemConfig.asset_tune,
        },
        tts: {
            ...systemConfig.tts,
            ...newSystemConfig.tts,
        },
        theme: {
            ...systemConfig.theme,
            ...newSystemConfig.theme,
        },
        giveaway: {
            ...systemConfig.giveaway,
            ...newSystemConfig.giveaway,
        },
        category_library: {
            ...systemConfig.category_library,
            ...newSystemConfig.category_library,
        },
        virtual_audio_cables: newSystemConfig.virtual_audio_cables !== undefined
            ? newSystemConfig.virtual_audio_cables
            : systemConfig.virtual_audio_cables,
        cava: newSystemConfig.cava
            ? {
                ...systemConfig.cava,
                ...newSystemConfig.cava,
                input: {
                    ...systemConfig.cava.input,
                    ...newSystemConfig.cava.input,
                },
                output: {
                    ...systemConfig.cava.output,
                    ...newSystemConfig.cava.output,
                },
                // Important: targets must be replaced, not merged.
                // Otherwise deleted frontend targets are merged back from the old settings object.
                targets: newSystemConfig.cava.targets !== undefined
                    ? newSystemConfig.cava.targets
                    : systemConfig.cava.targets,
            }
            : systemConfig.cava,
    });

    writeSystemConfigFile(systemConfig);

    emitSettingsUpdate();
    handleSystemConfigChange(previousSystemConfig, systemConfig);

    return systemConfig;
}

export function updateSystemConfig(newSystemConfig: Partial<StreambotSettings>) {
    return writeSystemConfig(newSystemConfig);
}

export function setSystemLanguage(language: string) {
    const normalizedLanguage = language.trim().toLowerCase();

    if (!normalizedLanguage) {
        throw new Error("language is required");
    }

    return writeSystemConfig({
        language: normalizedLanguage
    });
}

export function getSystemConfig() {
    return systemConfig;
}

export function getLanguage() {
    return systemConfig.language;
}

export function getGiveawaySettings() {
    return systemConfig.giveaway;
}

export function getTouchWallpaper() {
    return systemConfig.touch_wallpaper;
}

export function setTouchWallpaper(touchWallpaper: string) {
    return writeSystemConfig({
        touch_wallpaper: String(touchWallpaper ?? "").trim(),
    });
}

export function getAssetTuneSettings() {
    return systemConfig.asset_tune;
}

export function updateAssetTuneSettings(newAssetTuneSettings: Partial<AssetTuneSettings>) {
    return writeSystemConfig({
        asset_tune: newAssetTuneSettings as AssetTuneSettings,
    });
}

export function getTtsSettings() {
    return systemConfig.tts;
}

export function updateTtsSettings(newTtsSettings: Partial<TtsSettings>) {
    return writeSystemConfig({
        tts: {
            ...systemConfig.tts,
            ...newTtsSettings,
        },
    });
}

export function getVirtualAudioCableSettings() {
    return systemConfig.virtual_audio_cables;
}

export function updateVirtualAudioCableSettings(cables: VirtualAudioCableSettings[]) {
    return writeSystemConfig({virtual_audio_cables: cables});
}

export function getCategoryLibrarySettings() {
    return systemConfig.category_library;
}

export function updateCategoryLibrarySettings(newSettings: Partial<CategoryLibrarySettings>) {
    return writeSystemConfig({
        category_library: {
            ...systemConfig.category_library,
            ...newSettings,
        },
    });
}

export function getThemeSettings() {
    return systemConfig.theme;
}

export function updateThemeSettings(newThemeSettings: Partial<ThemeSettings>) {
    return writeSystemConfig({
        theme: {
            ...systemConfig.theme,
            ...newThemeSettings,
        },
    });
}

export function getCavaSettings() {
    return systemConfig.cava;
}

export function updateCavaSettings(newCavaSettings: Partial<CavaSettings>) {
    return writeSystemConfig({
        cava: newCavaSettings as CavaSettings,
    });
}

export default function readConfig(standalone = false) {
    if (standalone) {
        let standaloneConfig = {}
        try {
            standaloneConfig = parseConfig(`${__dirname}/../..`, ".env.conf");
        } catch (error) {
            logNotice('env config load failed:')
            logNotice(JSON.stringify(error, Object.getOwnPropertyNames(error)))
        }
        readSystemConfig();
        return withSystemConfig(standaloneConfig);
    }

    try {
        config = parseConfig(`${__dirname}/../..`, ".env.conf");
    } catch (error) {
        logNotice('env config load failed:')
        logNotice(JSON.stringify(error, Object.getOwnPropertyNames(error)))
    }
    readSystemConfig();

    return withSystemConfig(config);
}

export function getRawConfig() {
    return {
        raw: readFileSync(path.resolve(`${__dirname}/../..`, ".env.conf"), "utf8"),
        parsed: withSystemConfig(config),
        system_config: systemConfig
    };
}

export function writeRawConfig(content: string) {
    writeFileSync(path.resolve(`${__dirname}/../..`, ".env.conf"), content, "utf8");
}

export function getConfig(filter: RegExp | undefined = undefined, asObject = false) {
    const mergedConfig = withSystemConfig(config);

    if (!filter) return mergedConfig;

    const result: any = asObject ? {} : [];

    for (const key in mergedConfig) {
        if (!key.match(filter)) {
            continue;
        }

        if (asObject) {
            const realKey = key.replace(filter, "");
            result[realKey] = mergedConfig[key];
        } else {
            result.push(mergedConfig[key]);
        }
    }

    return result;
}

export function getFullConfig() {
    return withSystemConfig(config);
}

export async function loadPrimaryChannel(client: TwitchClient) {
    logRegular("fetch primary channel");

    primaryChannel = await client.getBot().api.users.getUserByName(
        getConfig(/twitch/g)[0]["channels"][0]
    );
}

export function getPrimaryChannel() {
    return primaryChannel;
}

export function getParsedPrimaryChannel() {
    const channel: any = primaryChannel;

    if (!channel) {
        return undefined;
    }

    return {
        id: channel.id,
        name: channel.name,
        display_name: channel.displayName,
        description: channel.description,
        profile_picture_url: channel.profilePictureUrl,
        offline_placeholder_url: channel.offlinePlaceholderUrl,
        creation_date: channel.creationDate?.toISOString?.() ?? channel.creationDate,
        type: channel.type,
        broadcaster_type: channel.broadcasterType,
    };
}

export function watchConfig() {
    if (configWatcherRegistered) {
        return;
    }

    configWatcherRegistered = true;

    logRegular("watch config file");

    // Make sure the settings file exists before watchFile is registered.
    // Otherwise the first auto-created file can immediately trigger the watcher.
    readSystemConfig();

    watchFile(
        `${__dirname}/../../.env.conf`,
        {
            persistent: true,
            interval: 250
        },
        (curr, prev) => {
            if (curr.mtimeMs === prev.mtimeMs) {
                return;
            }

            logNotice("config update detected");
            scheduleReload();
        }
    );

    watchFile(
        systemConfigPath,
        {
            persistent: true,
            interval: 250
        },
        (curr, prev) => {
            if (curr.mtimeMs === prev.mtimeMs) {
                return;
            }

            logNotice("system config update detected");
            const previousSystemConfig = systemConfig;
            const nextSystemConfig = readSystemConfig();
            handleSystemConfigChange(previousSystemConfig, nextSystemConfig);
        }
    );
}

// Backwards-compatible aliases for existing imports.
export const readSettings = readSystemConfig;
export const writeSettings = writeSystemConfig;
export const updateSettings = updateSystemConfig;
export const getSettings = getSystemConfig;
