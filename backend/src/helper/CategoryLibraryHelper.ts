import * as fs from "node:fs";
import * as path from "node:path";
import {spawn} from "node:child_process";
import {getAssetTuneSettings, getSystemConfigDirectory, readSystemConfig, type CategoryLibraryMediaSlot} from "./ConfigHelper";
import {emitAssetUpdate, resolveAssetPath} from "./AssetManagementHelper";
import {getSteamIntegration} from "./IntegrationsHelper";
import {imageRegex, videoRegex} from "./AssetHelper";
import {logNotice, logRegular, logWarn} from "./LogHelper";
import getWebsocketServer from "../App";
import {fetchGameInfo, pushGameInfo, setManualColor} from "./GameHelper";
import {getGamesInfoData} from "../clients/website/WebsiteClient";

export type CategoryMediaOrientation = "horizontal" | "vertical" | "any";

export type CategoryMediaEntry = {
    name: string;
    path: string;
};

type ResolvedCategoryMediaEntry = CategoryMediaEntry & {
    target?: string;
    orientation: CategoryMediaOrientation;
    type: "image" | "video";
    autoplay: boolean;
    loop: boolean;
    muted: boolean;
};

export type CategoryLibraryEntry = {
    category_id: string;
    name: string;
    cover_path?: string;
    cover_url?: string;
    steam_app_id?: number;
    shop_url?: string;
    wallpaper_path?: string;
    wallpaper_url?: string;
    steam_wallpaper_path?: string;
    steam_wallpaper_url?: string;
    theme_color?: string;
    custom_css?: string;
    obs_filters: Record<string, any>;
    channel_points: string[];
    blocked_channel_points: string[];
    custom_media: CategoryMediaEntry[];
    use_as_media_fallback: boolean;
    active: boolean;
    created_at: string;
    updated_at: string;
};

type CategoryLibraryFile = {
    version: 1;
    categories: Record<string, CategoryLibraryEntry>;
};

const categoryLibraryRoot = path.join(getSystemConfigDirectory(), "category_library");
const legacyCategoryLibraryPath = path.join(categoryLibraryRoot, "categories.json");
const downloadedAssetRoot = path.join(getSystemConfigDirectory(), "assets", "category_library");

let cache: CategoryLibraryFile | null = null;
let activeCategoryId = "";
let activeMediaTargets = new Set<string>();
let steamAppCache: {expires: number; apps: Array<{appid: number; name: string}>} | null = null;


function currentCategoryLibrarySettings() {
    return readSystemConfig().category_library;
}

function nowIso() {
    return new Date().toISOString();
}

function normalizeHexColor(value: unknown): string | undefined {
    const clean = String(value ?? "").trim().replace(/^#/, "").toLowerCase();
    return /^[0-9a-f]{6}$/.test(clean) ? clean : undefined;
}

function safeCategoryId(value: unknown): string {
    const id = String(value ?? "").trim();
    if (!id || !/^\d+$/.test(id)) throw new Error("category_id is invalid");
    return id;
}


function normalizeChannelPointNames(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    const result: string[] = [];
    const seen = new Set<string>();
    for (const item of value) {
        const name = String(typeof item === "string" ? item : (item as any)?.name ?? (item as any)?.label ?? "").trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(name);
    }
    return result;
}

function sanitizeMediaEntry(value: any, validateSlot = false): CategoryMediaEntry {
    const mediaPath = String(value?.path ?? "").replace(/\\/g, "/").replace(/^\/+/, "").trim();
    if (!mediaPath) throw new Error("custom media path is required");

    const resolved = resolveAssetPath(mediaPath);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
        throw new Error(`custom media not found: ${mediaPath}`);
    }

    if (!imageRegex.test(mediaPath) && !videoRegex.test(mediaPath)) {
        throw new Error(`unsupported custom media: ${mediaPath}`);
    }

    // New format stores only the global slot name plus the category-specific file.
    // Map old target/orientation entries to a slot name while reading existing libraries.
    const name = String(value?.name ?? value?.target ?? value?.orientation ?? "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-");
    if (!name) throw new Error("custom media name is required");

    if (validateSlot && !currentCategoryLibrarySettings().media_slots.some(slot => slot.name === name)) {
        throw new Error(`unknown custom media slot: ${name}`);
    }

    return {name, path: mediaPath};
}

function resolveMediaEntry(media: CategoryMediaEntry): ResolvedCategoryMediaEntry | null {
    const slot = currentCategoryLibrarySettings().media_slots.find(item => item.name === media.name);
    if (!slot) return null;

    return {
        ...media,
        target: slot.target,
        orientation: slot.orientation,
        type: videoRegex.test(media.path) ? "video" : "image",
        autoplay: slot.autoplay,
        loop: slot.loop,
        muted: slot.muted,
    };
}

function resolvedCustomMedia(entry: CategoryLibraryEntry): ResolvedCategoryMediaEntry[] {
    return entry.custom_media
        .map(resolveMediaEntry)
        .filter((media): media is ResolvedCategoryMediaEntry => Boolean(media));
}

function normalizeEntry(value: any, existing?: CategoryLibraryEntry): CategoryLibraryEntry {
    const categoryId = safeCategoryId(value?.category_id ?? value?.categoryId ?? existing?.category_id);
    const created = existing?.created_at ?? nowIso();

    return {
        category_id: categoryId,
        name: String(value?.name ?? existing?.name ?? "").trim() || `Category ${categoryId}`,
        cover_path: value?.cover_path ?? existing?.cover_path,
        cover_url: value?.cover_url ?? existing?.cover_url,
        steam_app_id: value?.steam_app_id !== undefined ? Number(value.steam_app_id) : existing?.steam_app_id,
        shop_url: String(value?.shop_url ?? existing?.shop_url ?? "") || undefined,
        wallpaper_path: value?.wallpaper_path ?? existing?.wallpaper_path,
        wallpaper_url: value?.wallpaper_url ?? existing?.wallpaper_url,
        steam_wallpaper_path: value?.steam_wallpaper_path ?? existing?.steam_wallpaper_path,
        steam_wallpaper_url: value?.steam_wallpaper_url ?? existing?.steam_wallpaper_url,
        theme_color: normalizeHexColor(value?.theme_color ?? existing?.theme_color),
        custom_css: String(value?.custom_css ?? existing?.custom_css ?? ""),
        obs_filters: value?.obs_filters && typeof value.obs_filters === "object" && !Array.isArray(value.obs_filters)
            ? structuredClone(value.obs_filters)
            : structuredClone(existing?.obs_filters ?? {}),
        channel_points: value?.channel_points !== undefined
            ? normalizeChannelPointNames(value.channel_points)
            : structuredClone(existing?.channel_points ?? []),
        blocked_channel_points: value?.blocked_channel_points !== undefined
            ? normalizeChannelPointNames(value.blocked_channel_points)
            : structuredClone(existing?.blocked_channel_points ?? []),
        custom_media: Array.isArray(value?.custom_media)
            ? value.custom_media.map(item => sanitizeMediaEntry(item, !existing))
            : (existing?.custom_media ?? []),
        use_as_media_fallback: value?.use_as_media_fallback !== undefined
            ? Boolean(value.use_as_media_fallback)
            : Boolean(existing?.use_as_media_fallback),
        active: value?.active !== undefined
            ? Boolean(value.active)
            : Boolean(existing?.active),
        created_at: created,
        updated_at: String(value?.updated_at ?? existing?.updated_at ?? nowIso()),
    };
}

function ensureDirs() {
    fs.mkdirSync(categoryLibraryRoot, {recursive: true});
    fs.mkdirSync(downloadedAssetRoot, {recursive: true});
}

function categoryFilePath(categoryId: string) {
    return path.join(categoryLibraryRoot, `${safeCategoryId(categoryId)}.json`);
}

function isCategoryFileName(name: string) {
    return /^\d+\.json$/.test(name);
}

function writeCategoryFile(entry: CategoryLibraryEntry) {
    const normalized = normalizeEntry(entry, entry);
    const serialized = JSON.stringify(normalized, null, 2);

    // Never create meaningless/empty JSON files. A persisted category must at
    // minimum have the normalized category id and name.
    if (!normalized.category_id || !normalized.name || serialized === "{}") return;

    ensureDirs();
    const target = categoryFilePath(normalized.category_id);
    const temporary = `${target}.tmp`;
    fs.writeFileSync(temporary, `${serialized}\n`, "utf8");
    fs.renameSync(temporary, target);
}

function migrateLegacyLibrary() {
    if (!fs.existsSync(legacyCategoryLibraryPath)) return;

    try {
        const parsed = JSON.parse(fs.readFileSync(legacyCategoryLibraryPath, "utf8"));
        const categories = parsed?.categories && typeof parsed.categories === "object"
            ? parsed.categories
            : {};

        for (const [id, raw] of Object.entries(categories)) {
            try {
                const entry = normalizeEntry({...raw as any, category_id: (raw as any)?.category_id ?? id}, raw as CategoryLibraryEntry);
                writeCategoryFile(entry);
            } catch (error: any) {
                logWarn(`category library migration skipped invalid category ${id}: ${error?.message ?? error}`);
            }
        }

        fs.unlinkSync(legacyCategoryLibraryPath);
        logRegular("category library migrated categories.json to per-category files");
    } catch (error: any) {
        logWarn(`category library migration failed: ${error?.message ?? error}`);
    }
}

function readLibrary(): CategoryLibraryFile {
    if (cache) return cache;
    ensureDirs();
    migrateLegacyLibrary();

    cache = {version: 1, categories: {}};

    for (const fileName of fs.readdirSync(categoryLibraryRoot)) {
        if (!isCategoryFileName(fileName)) continue;

        const filePath = path.join(categoryLibraryRoot, fileName);
        try {
            const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
            if (!raw || typeof raw !== "object" || Array.isArray(raw) || Object.keys(raw).length === 0) {
                // Empty JSON is never valid category data. Remove it instead of
                // carrying a broken entry forever.
                fs.unlinkSync(filePath);
                continue;
            }

            const idFromFile = fileName.slice(0, -5);
            const entry = normalizeEntry({...raw, category_id: raw.category_id ?? idFromFile}, raw as CategoryLibraryEntry);
            cache.categories[entry.category_id] = entry;

            // Normalize old/partial category files while they are loaded.
            writeCategoryFile(entry);
        } catch (error: any) {
            logWarn(`category library ignored invalid file ${fileName}: ${error?.message ?? error}`);
        }
    }

    return cache;
}

function writeLibrary() {
    ensureDirs();
    const data = readLibrary();
    const expectedFiles = new Set<string>();

    for (const entry of Object.values(data.categories)) {
        if (!entry?.category_id || !entry?.name) continue;
        writeCategoryFile(entry);
        expectedFiles.add(`${entry.category_id}.json`);
    }

    // Remove category files whose entries were deleted from the in-memory library.
    for (const fileName of fs.readdirSync(categoryLibraryRoot)) {
        if (!isCategoryFileName(fileName) || expectedFiles.has(fileName)) continue;
        try { fs.unlinkSync(path.join(categoryLibraryRoot, fileName)); } catch (_) {}
    }

    emitCategoryLibraryUpdate();
}

export function getCategoryLibrary() {
    const library = readLibrary();
    // The websocket store snapshot should always reflect the persisted settings file,
    // even when a client connects while another settings update is being processed.
    const settings = readSystemConfig().category_library;
    const activeCategory = getActiveCategoryEntry();

    return {
        version: 1,
        enabled: settings.enabled,
        settings,
        steam: {
            configured: Boolean(String(getSteamIntegration().api_key ?? "").trim()),
        },
        active_category_id: activeCategoryId || null,
        active_category: activeCategory,
        effective_media: activeCategory ? findMediaSource(activeCategory) : null,
        effective_obs_filters: getActiveCategoryObsFilterPayload(),
        active_channel_points: getActiveCategoryChannelPointState(),
        active_style: {
            category_id: activeCategory?.category_id ?? null,
            category_name: activeCategory?.name ?? null,
            css: settings.enabled && settings.apply_custom_css
                ? activeCategory?.custom_css ?? ""
                : "",
        },
        categories: Object.values(library.categories).sort((a, b) => a.name.localeCompare(b.name)),
    };
}

export function getCategoryEntry(categoryId: string | number) {
    return readLibrary().categories[String(categoryId)] ?? null;
}

function hasObsFilterData(entry: CategoryLibraryEntry | null | undefined): boolean {
    if (!entry?.obs_filters || typeof entry.obs_filters !== "object" || Array.isArray(entry.obs_filters)) return false;
    return Object.keys(entry.obs_filters).length > 0;
}

export function findObsFilterSource(entry: CategoryLibraryEntry | null | undefined): {entry: CategoryLibraryEntry; filters: Record<string, any>} | null {
    if (!entry) return null;

    if (hasObsFilterData(entry)) {
        return {entry, filters: structuredClone(entry.obs_filters)};
    }

    const fallback = Object.values(readLibrary().categories)
        .find(item => item.use_as_media_fallback && hasObsFilterData(item));

    if (!fallback) return null;
    return {entry: fallback, filters: structuredClone(fallback.obs_filters)};
}

export function getActiveCategoryObsFilters(): Record<string, any> {
    const source = findObsFilterSource(getActiveCategoryEntry());
    return structuredClone(source?.filters ?? {});
}

export function getActiveCategoryObsFilterPayload() {
    const active = getActiveCategoryEntry();
    const source = findObsFilterSource(active);
    return {
        category_id: active?.category_id ?? null,
        obs_filter_category_id: source?.entry.category_id ?? null,
        obs_filter_category_name: source?.entry.name ?? null,
        fallback: Boolean(active && source && active.category_id !== source.entry.category_id),
        filters: structuredClone(source?.filters ?? {}),
    };
}

export function setActiveCategoryObsFilters(filters: Record<string, any>) {
    const entry = getActiveCategoryEntry();
    if (!entry) throw new Error("no active category");

    entry.obs_filters = filters && typeof filters === "object" && !Array.isArray(filters)
        ? structuredClone(filters)
        : {};
    entry.updated_at = nowIso();
    writeLibrary();
    return structuredClone(entry.obs_filters);
}

export function getActiveCategoryChannelPointState() {
    const entry = getActiveCategoryEntry();
    return {
        category_id: entry?.category_id ?? null,
        category_name: entry?.name ?? null,
        channel_points: structuredClone(entry?.channel_points ?? []),
        blocked_channel_points: structuredClone(entry?.blocked_channel_points ?? []),
    };
}

export function saveCategoryEntry(input: any) {
    const library = readLibrary();
    const id = safeCategoryId(input?.category_id ?? input?.categoryId);
    library.categories[id] = normalizeEntry(input, library.categories[id]);
    if (Array.isArray(input?.custom_media)) {
        library.categories[id].custom_media = input.custom_media.map((item: any) => sanitizeMediaEntry(item, true));
    }

    // Only one category can be the global media fallback at a time.
    if (library.categories[id].use_as_media_fallback) {
        for (const [otherId, other] of Object.entries(library.categories)) {
            if (otherId !== id) other.use_as_media_fallback = false;
        }
    }

    writeLibrary();

    if (activeCategoryId === id) void applyActiveCategory(library.categories[id]);
    return library.categories[id];
}

export function deleteCategoryEntry(categoryId: string | number) {
    const id = safeCategoryId(categoryId);
    const library = readLibrary();
    const wasActive = activeCategoryId === id || Boolean(library.categories[id]?.active);
    delete library.categories[id];

    if (wasActive) {
        activeCategoryId = "";
        clearActiveMedia();
        emitCategoryStyle(null);
        getWebsocketServer().send("notify_category_active", {category: null, effective_media: null});
    }

    writeLibrary();
    return {category_id: id};
}

export function emitCategoryLibraryUpdate() {
    try {
        const payload = getCategoryLibrary();
        const delivered = getWebsocketServer().send("notify_category_library_update", payload);
        logRegular(`category library notify: ${payload.categories?.length ?? Object.keys(payload.categories ?? {}).length} categories, active=${payload.active_category_id ?? "none"}, clients=${delivered}`);
        if (delivered === 0) {
            logWarn("category library notify had no subscribed websocket clients; subscribe to notify_category_library_update or use the all endpoint set");
        }
    } catch (error: any) {
        logWarn(`category library notify failed: ${error?.message ?? error}`);
    }
}

function emitCategoryLibraryUpdateSettled() {
    // Emit after the current mutation/activation stack has finished as well.
    // This guarantees Pinia/admin stores see the final active category and any
    // newly-created/imported category in one authoritative snapshot.
    queueMicrotask(() => emitCategoryLibraryUpdate());
}

function emitCategoryStyle(entry: CategoryLibraryEntry | null) {
    getWebsocketServer().send("notify_category_style_update", {
        category_id: entry?.category_id ?? null,
        category_name: entry?.name ?? null,
        css: entry?.custom_css ?? "",
    });
}

class RemoteAssetHttpError extends Error {
    constructor(public readonly status: number, public readonly sourceUrl: string) {
        super(`download failed (${status})`);
        this.name = "RemoteAssetHttpError";
    }
}

async function downloadToAsset(url: string, relativePath: string): Promise<string> {
    const response = await fetch(url, {headers: {"User-Agent": "stream-overlord/1.0"}});
    if (!response.ok) throw new RemoteAssetHttpError(response.status, url);
    const bytes = Buffer.from(await response.arrayBuffer());
    const target = resolveAssetPath(relativePath);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, bytes);
    return relativePath.replace(/\\/g, "/");
}

async function ensureCover(entry: CategoryLibraryEntry, game: any) {
    const settings = currentCategoryLibrarySettings();
    if (!settings.fetch_cover || (entry.cover_path && fs.existsSync(resolveAssetPath(entry.cover_path)))) return;

    const source = game?.boxArtUrl
        ? String(game.boxArtUrl).replace("{width}", "600").replace("{height}", "800")
        : "";
    if (!source) return;

    try {
        const relative = `category_library/${entry.category_id}/cover.jpg`;
        entry.cover_path = await downloadToAsset(source, relative);
        entry.cover_url = source;
    } catch (error: any) {
        logWarn(`category library cover download failed: ${error?.message ?? error}`);
    }
}

function normalizeSteamName(name: string) {
    return name.toLowerCase().replace(/[™®©:–—\-]/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
}

async function getSteamApps(apiKey: string) {
    const now = Date.now();
    if (steamAppCache && steamAppCache.expires > now) return steamAppCache.apps;

    const apps: Array<{appid: number; name: string}> = [];
    let lastAppId = 0;

    // ISteamApps/GetAppList/v2 was deprecated/removed by Valve.
    // IStoreService/GetAppList/v1 is the current replacement and is paginated.
    for (let page = 0; page < 20; page++) {
        const url = new URL("https://api.steampowered.com/IStoreService/GetAppList/v1/");
        url.searchParams.set("key", apiKey);
        url.searchParams.set("include_games", "true");
        url.searchParams.set("include_dlc", "false");
        url.searchParams.set("include_software", "false");
        url.searchParams.set("include_videos", "false");
        url.searchParams.set("include_hardware", "false");
        url.searchParams.set("max_results", "50000");
        if (lastAppId > 0) url.searchParams.set("last_appid", String(lastAppId));

        const response = await fetch(url, {headers: {"User-Agent": "stream-overlord/1.0"}});
        if (!response.ok) throw new Error(`Steam app list failed (${response.status})`);

        const payload: any = await response.json();
        const body = payload?.response ?? {};
        const pageApps = Array.isArray(body.apps) ? body.apps : [];

        for (const app of pageApps) {
            const appid = Number(app?.appid ?? 0);
            const name = String(app?.name ?? "").trim();
            if (appid > 0 && name) apps.push({appid, name});
        }

        if (!body.have_more_results || pageApps.length === 0) break;

        const nextLastAppId = Number(body.last_appid ?? pageApps[pageApps.length - 1]?.appid ?? 0);
        if (!nextLastAppId || nextLastAppId <= lastAppId) break;
        lastAppId = nextLastAppId;
    }

    steamAppCache = {expires: now + 6 * 60 * 60 * 1000, apps};
    return apps;
}

async function resolveSteamApp(name: string, apiKey: string) {
    const apps = await getSteamApps(apiKey);
    const wanted = normalizeSteamName(name);
    return apps.find(app => normalizeSteamName(String(app.name ?? "")) === wanted) ?? null;
}

async function ensureSteamWallpaper(entry: CategoryLibraryEntry) {
    const settings = currentCategoryLibrarySettings();
    if (!settings.fetch_steam_wallpaper || (entry.wallpaper_path && fs.existsSync(resolveAssetPath(entry.wallpaper_path))) || (entry.steam_wallpaper_path && fs.existsSync(resolveAssetPath(entry.steam_wallpaper_path)))) return;

    const apiKey = String(getSteamIntegration().api_key ?? "").trim();
    if (!apiKey) return;

    try {
        let appId = entry.steam_app_id;
        if (!appId) {
            const app = await resolveSteamApp(entry.name, apiKey);
            appId = Number(app?.appid || 0) || undefined;
            if (appId) entry.steam_app_id = appId;
        }
        if (!appId) return;

        const response = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}&l=english`);
        if (!response.ok) throw new Error(`Steam app details failed (${response.status})`);
        const payload: any = await response.json();
        const data = payload?.[String(appId)]?.data;
        const source = String(data?.background_raw ?? data?.background ?? data?.header_image ?? "").trim();
        if (!source) return;

        const relative = `category_library/${entry.category_id}/wallpaper.jpg`;
        entry.steam_wallpaper_path = await downloadToAsset(source, relative);
        entry.steam_wallpaper_url = source;
    } catch (error: any) {
        logNotice(`category library Steam wallpaper lookup failed for ${entry.name}: ${error?.message ?? error}`);
    }
}

async function extractAverageColorWithFfmpeg(filePath: string): Promise<string> {
    const ffmpeg = getAssetTuneSettings().ffmpeg_bin || "ffmpeg";

    return await new Promise<string>((resolve, reject) => {
        const child = spawn(ffmpeg, [
            "-hide_banner",
            "-loglevel", "error",
            "-i", filePath,
            "-vf", "scale=1:1",
            "-frames:v", "1",
            "-f", "rawvideo",
            "-pix_fmt", "rgb24",
            "pipe:1",
        ], {stdio: ["ignore", "pipe", "pipe"]});

        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];
        child.stdout.on("data", chunk => stdout.push(Buffer.from(chunk)));
        child.stderr.on("data", chunk => stderr.push(Buffer.from(chunk)));
        child.on("error", reject);
        child.on("close", code => {
            if (code !== 0) {
                reject(new Error(Buffer.concat(stderr).toString("utf8").trim() || `ffmpeg exited with ${code}`));
                return;
            }

            const rgb = Buffer.concat(stdout);
            if (rgb.length < 3) {
                reject(new Error("ffmpeg returned no RGB pixel"));
                return;
            }

            resolve([rgb[0], rgb[1], rgb[2]].map(value => value.toString(16).padStart(2, "0")).join(""));
        });
    });
}

async function ensureThemeColor(entry: CategoryLibraryEntry) {
    const settings = currentCategoryLibrarySettings();
    if (!settings.auto_theme_color || entry.theme_color || !entry.cover_path) return;

    try {
        const cover = resolveAssetPath(entry.cover_path);
        if (!fs.existsSync(cover) || !fs.statSync(cover).isFile()) {
            logNotice(`category library color extraction skipped: cover is missing for ${entry.name}`);
            return;
        }

        entry.theme_color = await extractAverageColorWithFfmpeg(cover);
    } catch (error: any) {
        logWarn(`category library color extraction failed for ${entry.name}: ${error?.message ?? error}`);
    }
}

function findMediaSource(entry: CategoryLibraryEntry): {entry: CategoryLibraryEntry; media: ResolvedCategoryMediaEntry[]} | null {
    const ownMedia = resolvedCustomMedia(entry);
    if (ownMedia.length) return {entry, media: ownMedia};

    const fallback = Object.values(readLibrary().categories)
        .find(item => item.use_as_media_fallback && resolvedCustomMedia(item).length > 0);
    if (fallback) return {entry: fallback, media: resolvedCustomMedia(fallback)};

    const wallpaperPath = entry.wallpaper_path || entry.steam_wallpaper_path;
    if (wallpaperPath) {
        return {
            entry,
            media: [{
                name: entry.wallpaper_path ? "wallpaper" : "steam-wallpaper",
                path: wallpaperPath,
                target: "background",
                orientation: "horizontal",
                type: videoRegex.test(wallpaperPath) ? "video" : "image",
                autoplay: true,
                loop: true,
                muted: true,
            }],
        };
    }

    return null;
}

function clearActiveMedia() {
    for (const target of activeMediaTargets) {
        getWebsocketServer().send("notify_media_update", {media: "clear_media", target});
    }
    activeMediaTargets.clear();
}

async function applyActiveCategory(entry: CategoryLibraryEntry) {
    const settings = currentCategoryLibrarySettings();
    if (!settings.enabled) return;

    if (settings.apply_theme_color) {
        if (entry.theme_color) setManualColor(entry.theme_color);
        else setManualColor();
    } else {
        setManualColor();
    }

    // Rebuild the public game/theme payload only after the Category Library has
    // an active entry. This keeps notify_game_update, template variables and the
    // overlay theme in sync with the exact same category state.
    await fetchGameInfo();
    pushGameInfo();
    logRegular(`category library theme applied: ${entry.name} (${entry.category_id}) color=${entry.theme_color ? `#${entry.theme_color}` : "default"}`);

    if (settings.apply_custom_css) emitCategoryStyle(entry);
    else emitCategoryStyle(null);

    if (settings.apply_media) {
        clearActiveMedia();
        const source = findMediaSource(entry);
        if (source) {
            for (const media of source.media) {
                const target = `category-${media.target || media.orientation || "default"}`;
                activeMediaTargets.add(target);
                getWebsocketServer().send("notify_media_update", {
                    media: "show_media",
                    target,
                    name: media.name,
                    path: media.path,
                    type: media.type,
                    autoplay: media.autoplay,
                    loop: media.loop,
                    muted: media.muted,
                    orientation: media.orientation,
                    category_id: entry.category_id,
                    media_category_id: source.entry.category_id,
                });
            }
        }
    }

    if (settings.apply_obs_filters) {
        try {
            const {updateSourceFilters} = await import("./SourceHelper");
            await updateSourceFilters();
        } catch (error: any) {
            logWarn(`category library OBS filter apply failed for ${entry.name}: ${error?.message ?? error}`);
        }
    }

    if (settings.apply_channel_points) {
        try {
            const {updateChannelPoints} = await import("./ChannelPointHelper");
            await updateChannelPoints();
        } catch (error: any) {
            logWarn(`category library channel point apply failed for ${entry.name}: ${error?.message ?? error}`);
        }
    }

    getWebsocketServer().send("notify_category_active", {
        category: entry,
        effective_media: findMediaSource(entry),
    });
}


export function getActiveCategoryEntry() {
    const library = readLibrary();

    if (activeCategoryId) {
        const active = library.categories[activeCategoryId];
        if (active) return active;
    }

    const persistedActive = Object.values(library.categories).find(entry => entry.active);
    if (persistedActive) {
        activeCategoryId = persistedActive.category_id;
        return persistedActive;
    }

    return null;
}

function markCategoryActive(categoryId: string) {
    const library = readLibrary();
    const entry = library.categories[categoryId];
    if (!entry) throw new Error("category not found");

    for (const category of Object.values(library.categories)) {
        const shouldBeActive = category.category_id === categoryId;
        if (category.active !== shouldBeActive) {
            category.active = shouldBeActive;
            category.updated_at = nowIso();
            writeCategoryFile(category);
        }
    }

    activeCategoryId = categoryId;
    return entry;
}

export function getActiveCategoryPayload() {
    const entry = getActiveCategoryEntry();
    if (!entry) return {category: null, effective_media: null, effective_obs_filters: getActiveCategoryObsFilterPayload(), active_channel_points: getActiveCategoryChannelPointState()};
    return {
        category: entry,
        effective_media: findMediaSource(entry),
        effective_obs_filters: getActiveCategoryObsFilterPayload(),
        active_channel_points: getActiveCategoryChannelPointState(),
    };
}

export function getActiveCategoryStylePayload() {
    const entry = getActiveCategoryEntry();
    return {
        category_id: entry?.category_id ?? null,
        category_name: entry?.name ?? null,
        css: currentCategoryLibrarySettings().enabled && currentCategoryLibrarySettings().apply_custom_css
            ? entry?.custom_css ?? ""
            : "",
    };
}

export function getActiveCategoryMediaNotifications() {
    const entry = getActiveCategoryEntry();
    if (!entry || !currentCategoryLibrarySettings().enabled || !currentCategoryLibrarySettings().apply_media) return [];
    const source = findMediaSource(entry);
    if (!source) return [];
    return source.media.map(media => ({
        media: "show_media",
        target: `category-${media.target || media.orientation || "default"}`,
        name: media.name,
        path: media.path,
        type: media.type,
        autoplay: media.autoplay,
        loop: media.loop,
        muted: media.muted,
        orientation: media.orientation,
        category_id: entry.category_id,
        media_category_id: source.entry.category_id,
    }));
}

/**
 * Full, authoritative media state for a freshly registered websocket client.
 * Clear every category-owned target first, then replay the currently effective
 * category media. This prevents stale media surviving an overlay reconnect.
 */
export function getActiveCategoryMediaReplayNotifications() {
    const settings = currentCategoryLibrarySettings();
    const targets = new Set<string>(["category-background"]);

    for (const slot of settings.media_slots ?? []) {
        const target = slot.target || slot.orientation || slot.name || "default";
        targets.add(`category-${target}`);
    }

    for (const media of getActiveCategoryMediaNotifications()) {
        if (media?.target) targets.add(media.target);
    }

    const clears = [...targets].map(target => ({
        media: "clear_media",
        target,
    }));

    if (!settings.enabled || !settings.apply_media) return clears;
    return [...clears, ...getActiveCategoryMediaNotifications()];
}

export async function activateCategory(categoryId: string | number) {
    const id = safeCategoryId(categoryId);
    const entry = markCategoryActive(id);

    // Publish the active category immediately so stores and all category-aware
    // helpers see the new category before presentation state is applied.
    emitCategoryLibraryUpdate();

    await applyActiveCategory(entry);
    emitCategoryLibraryUpdateSettled();
    return entry;
}

export async function syncTwitchCategory(bot: any, event: any) {
    const settings = currentCategoryLibrarySettings();
    logRegular(`category library sync: enabled=${settings.enabled} category=${event?.categoryName ?? "unknown"} (${event?.categoryId ?? "none"})`);
    if (!settings.enabled) {
        logNotice("category library sync skipped: disabled in streambot-settings.json");
        return null;
    }

    if (!event?.categoryId) {
        logWarn("category library sync skipped: Twitch category id is missing");
        return null;
    }
    const categoryId = safeCategoryId(event.categoryId);
    const library = readLibrary();
    let entry = library.categories[categoryId];

    if (!entry && !settings.auto_create) return null;

    let game: any = null;
    try {
        game = await bot.api.games.getGameById(categoryId);
    } catch (error: any) {
        logWarn(`category library Twitch lookup failed: ${error?.message ?? error}`);
    }

    if (!entry) {
        entry = normalizeEntry({
            category_id: categoryId,
            name: event?.categoryName ?? game?.name ?? `Category ${categoryId}`,
            custom_media: [],
            channel_points: [],
            blocked_channel_points: [],
            use_as_media_fallback: false,
        });
        library.categories[categoryId] = entry;
        logRegular(`category library created ${entry.name} (${categoryId})`);
    } else if (event?.categoryName && entry.name !== event.categoryName) {
        entry.name = event.categoryName;
        entry.updated_at = nowIso();
    }

    // Mark the category active before any network/enrichment work. This makes
    // the category immediately visible to theme, channel-point and OBS helpers.
    entry = markCategoryActive(categoryId);
    // Persist the active category before notifying any websocket consumer.
    // markCategoryActive already writes changed entries, this explicit write also
    // covers a freshly-created category whose normalized active flag changed.
    writeCategoryFile(entry);
    logRegular(`category library active: ${entry.name} (${entry.category_id}); total=${Object.keys(readLibrary().categories).length}`);
    emitCategoryLibraryUpdate();

    await ensureCover(entry, game);
    await ensureSteamWallpaper(entry);
    await ensureThemeColor(entry);
    entry.updated_at = nowIso();
    writeCategoryFile(entry);
    emitAssetUpdate();

    await applyActiveCategory(entry);
    logRegular(`category library applied: ${entry.name} (${entry.category_id})${entry.theme_color ? ` color=#${entry.theme_color}` : ""}`);
    emitCategoryLibraryUpdateSettled();
    return entry;
}

export async function refreshCategory(categoryId: string | number, bot?: any) {
    const entry = getCategoryEntry(categoryId);
    if (!entry) throw new Error("category not found");

    let game: any = null;
    if (bot?.api?.games) {
        try { game = await bot.api.games.getGameById(entry.category_id); } catch (_) {}
    }

    // Clearing generated fields makes refresh explicitly fetch them again.
    entry.cover_path = undefined;
    entry.cover_url = undefined;
    entry.steam_wallpaper_path = undefined;
    entry.steam_wallpaper_url = undefined;
    if (currentCategoryLibrarySettings().auto_theme_color) entry.theme_color = undefined;

    await ensureCover(entry, game);
    await ensureSteamWallpaper(entry);
    await ensureThemeColor(entry);
    entry.updated_at = nowIso();
    writeLibrary();
    emitAssetUpdate();
    if (activeCategoryId === entry.category_id) await applyActiveCategory(entry);
    return entry;
}


function urlExtension(value: string, fallback = ".bin") {
    try {
        const pathname = new URL(value).pathname;
        const ext = path.extname(pathname).toLowerCase();
        return /^[.][a-z0-9]{1,8}$/.test(ext) ? ext : fallback;
    } catch (_) {
        const ext = path.extname(String(value).split("?")[0]).toLowerCase();
        return /^[.][a-z0-9]{1,8}$/.test(ext) ? ext : fallback;
    }
}

function importedObsFilters(sources: any): Record<string, any> {
    if (!sources || typeof sources !== "object" || Array.isArray(sources)) return {};
    const result: Record<string, any> = {};

    for (const [sourceUuid, source] of Object.entries(sources) as Array<[string, any]>) {
        const uuid = String(sourceUuid ?? "").trim();
        if (!uuid || !source || typeof source !== "object") continue;
        result[uuid] = {
            name: String(source?.name ?? uuid),
            obs_id: String(source?.obs_id ?? source?.obsId ?? "default"),
            filters: source?.filters && typeof source.filters === "object" && !Array.isArray(source.filters)
                ? structuredClone(source.filters)
                : {},
        };
    }

    return result;
}

function mergeImportedObsFilters(existing: Record<string, any>, incoming: Record<string, any>, overwrite: boolean) {
    if (overwrite) return structuredClone(incoming);
    const merged = structuredClone(existing ?? {});
    for (const [uuid, source] of Object.entries(incoming)) {
        if (!(uuid in merged)) merged[uuid] = source;
    }
    return merged;
}

async function importRemoteAsset(
    url: unknown,
    relativeBase: string,
    fallbackExtension: string,
    label?: string,
) {
    const source = String(url ?? "").trim();
    if (!source) return undefined;
    const relative = `${relativeBase}${urlExtension(source, fallbackExtension)}`;

    try {
        return await downloadToAsset(source, relative);
    } catch (error: any) {
        if (error instanceof RemoteAssetHttpError && error.status === 404) {
            logNotice(`category library website import: skipping 404${label ? ` ${label}` : ""}: ${source}`);
            return undefined;
        }
        throw error;
    }
}

export async function importCategoryLibraryFromWebsite(options: any = {}) {
    const overwrite = Boolean(options?.overwrite);
    const downloadMedia = options?.download_media !== false && options?.downloadMedia !== false;
    const requestedFallbackId = String(options?.fallback_category_id ?? options?.fallbackCategoryId ?? "").trim();
    const games = await getGamesInfoData();
    if (!Array.isArray(games)) throw new Error("website getGames returned no game list");

    const library = readLibrary();
    const slots = currentCategoryLibrarySettings().media_slots;
    const slotNames = new Set(slots.map(slot => slot.name));
    const previousFallbackId = Object.values(library.categories)
        .find(item => item.use_as_media_fallback)?.category_id ?? "";

    const summary = {
        total: games.length,
        imported: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
        downloaded: 0,
        not_found: 0,
        errors: [] as Array<{category_id?: string; name?: string; error: string}>,
    };

    logRegular(`category library website import: starting ${games.length} categories${downloadMedia ? " with media" : " without media"}`);

    const emitProgress = (index: number, categoryId?: string, name?: string, state = "processing") => {
        try {
            getWebsocketServer().send("notify_category_library_import_progress", {
                current: index,
                total: games.length,
                category_id: categoryId || null,
                name: name || null,
                state,
                summary: {...summary, errors: summary.errors.slice(-10)},
            });
        } catch (_) {}
    };

    for (let gameIndex = 0; gameIndex < games.length; gameIndex++) {
        const game = games[gameIndex];
        const progress = gameIndex + 1;
        let categoryId = "";
        let gameName = String(game?.game_name ?? "").trim();

        try {
            categoryId = safeCategoryId(game?.game_id);
            gameName = gameName || `Category ${categoryId}`;
            logRegular(`category library website import [${progress}/${games.length}]: ${gameName} (${categoryId})`);
            emitProgress(progress, categoryId, gameName);

            const existing = library.categories[categoryId];
            const wasExisting = Boolean(existing);
            const entry = existing ?? normalizeEntry({
                category_id: categoryId,
                name: gameName,
                custom_media: [],
                obs_filters: {},
                use_as_media_fallback: false,
            });

            if (overwrite || !entry.name || entry.name.startsWith("Category ")) entry.name = gameName;

            const themeColor = normalizeHexColor(game?.theme?.color);
            if (themeColor && (overwrite || !entry.theme_color)) entry.theme_color = themeColor;
            const css = String(game?.theme?.style ?? "");
            if (css && (overwrite || !entry.custom_css)) entry.custom_css = css;

            const shopUrl = String(game?.shop_url ?? "").trim();
            if (shopUrl && (overwrite || !entry.shop_url)) entry.shop_url = shopUrl;
            const steamMatch = shopUrl.match(/store\.steampowered\.com\/app\/(\d+)/i);
            if (steamMatch && (overwrite || !entry.steam_app_id)) entry.steam_app_id = Number(steamMatch[1]);

            // Support a website-side fallback flag if one is added/returned, while
            // preserving the locally selected fallback by default.
            const websiteFallback = game?.use_as_media_fallback ?? game?.useAsMediaFallback ?? game?.media_fallback;
            if (websiteFallback !== undefined && (overwrite || !existing)) {
                entry.use_as_media_fallback = Boolean(websiteFallback);
            }

            const incomingFilters = importedObsFilters(game?.sources);
            if (Object.keys(incomingFilters).length) {
                entry.obs_filters = mergeImportedObsFilters(entry.obs_filters, incomingFilters, overwrite);
            }

            const importedChannelPoints = normalizeChannelPointNames(game?.channel_points);
            const importedBlockedChannelPoints = normalizeChannelPointNames(game?.blocked_channel_points);
            if (overwrite || !existing || !entry.channel_points.length) {
                entry.channel_points = importedChannelPoints;
            }
            if (overwrite || !existing || !entry.blocked_channel_points.length) {
                entry.blocked_channel_points = importedBlockedChannelPoints;
            }

            if (downloadMedia) {
                const coverUrl = String(game?.media?.cover ?? "").trim();
                if (coverUrl && (overwrite || !entry.cover_path || !fs.existsSync(resolveAssetPath(entry.cover_path)))) {
                    const imported = await importRemoteAsset(
                        coverUrl,
                        `category_library/${categoryId}/cover-import`,
                        ".webp",
                        `${gameName} cover`,
                    );
                    if (imported) {
                        entry.cover_path = imported;
                        entry.cover_url = coverUrl;
                        summary.downloaded++;
                        logRegular(`category library website import [${progress}/${games.length}]: cover saved for ${gameName}`);
                    } else {
                        summary.not_found++;
                    }
                }

                // Try website wallpapers in priority order. A 404 on the preferred
                // animated version must not prevent falling back to the static wallpaper.
                const wallpaperCandidates = [
                    {label: "animated wallpaper", url: game?.media?.animated_background},
                    {label: "static wallpaper", url: game?.media?.static_background},
                ].filter(item => String(item.url ?? "").trim());

                if (overwrite || !entry.wallpaper_path || !fs.existsSync(resolveAssetPath(entry.wallpaper_path))) {
                    for (const candidate of wallpaperCandidates) {
                        const wallpaperUrl = String(candidate.url ?? "").trim();
                        const imported = await importRemoteAsset(
                            wallpaperUrl,
                            `category_library/${categoryId}/wallpaper-import`,
                            ".webp",
                            `${gameName} ${candidate.label}`,
                        );
                        if (!imported) {
                            summary.not_found++;
                            continue;
                        }

                        entry.wallpaper_path = imported;
                        entry.wallpaper_url = wallpaperUrl;
                        summary.downloaded++;
                        logRegular(`category library website import [${progress}/${games.length}]: ${candidate.label} saved for ${gameName}`);
                        break;
                    }
                }

                const sourceBackgrounds = game?.media?.source_backgrounds ?? {};
                const mediaByName = new Map(entry.custom_media.map(item => [item.name, item]));
                for (const name of ["horizontal", "vertical"]) {
                    if (!slotNames.has(name)) continue;
                    const mediaUrl = String(sourceBackgrounds?.[name] ?? "").trim();
                    if (!mediaUrl) continue;
                    const current = mediaByName.get(name);
                    if (!overwrite && current?.path && fs.existsSync(resolveAssetPath(current.path))) continue;

                    const imported = await importRemoteAsset(
                        mediaUrl,
                        `category_library/${categoryId}/custom-${name}`,
                        ".webm",
                        `${gameName} ${name}`,
                    );
                    if (!imported) {
                        summary.not_found++;
                        continue;
                    }
                    mediaByName.set(name, {name, path: imported});
                    summary.downloaded++;
                    logRegular(`category library website import [${progress}/${games.length}]: ${name} media saved for ${gameName}`);
                }
                entry.custom_media = [...mediaByName.values()];
            } else {
                // Keep the source URLs even when media download is disabled so an
                // admin can see where imported data came from.
                const coverUrl = String(game?.media?.cover ?? "").trim();
                if (coverUrl && (overwrite || !entry.cover_url)) entry.cover_url = coverUrl;
                const wallpaperUrl = String(game?.media?.animated_background || game?.media?.static_background || "").trim();
                if (wallpaperUrl && (overwrite || !entry.wallpaper_url)) entry.wallpaper_url = wallpaperUrl;
            }

            // Website colors are not always populated. Once the cover exists, derive
            // the missing color with ffmpeg before persisting the category.
            if (!entry.theme_color && entry.cover_path) {
                await ensureThemeColor(entry);
                if (entry.theme_color) {
                    logRegular(`category library website import [${progress}/${games.length}]: generated color #${entry.theme_color} for ${gameName}`);
                }
            }

            entry.updated_at = nowIso();
            const normalized = normalizeEntry(entry, entry);
            library.categories[categoryId] = normalized;

            // Persist each category immediately. A long import can now be interrupted
            // without losing all previously completed categories.
            writeCategoryFile(normalized);

            summary.imported++;
            if (wasExisting) summary.updated++; else summary.created++;
            emitProgress(progress, categoryId, gameName, "done");
        } catch (error: any) {
            summary.failed++;
            summary.errors.push({
                category_id: categoryId || String(game?.game_id ?? "") || undefined,
                name: gameName || undefined,
                error: error?.message ?? String(error),
            });
            logWarn(`category library website import [${progress}/${games.length}] failed for ${gameName || categoryId || "unknown"}: ${error?.message ?? error}`);
            emitProgress(progress, categoryId, gameName, "failed");
        }
    }

    // Explicit API option wins. Otherwise preserve the fallback selected before
    // import. If the website supplied a fallback flag, normalize it to exactly one.
    const fallbackId = requestedFallbackId || previousFallbackId || Object.values(library.categories)
        .find(item => item.use_as_media_fallback)?.category_id || "";
    if (fallbackId && library.categories[fallbackId]) {
        for (const entry of Object.values(library.categories)) {
            entry.use_as_media_fallback = entry.category_id === fallbackId;
            writeCategoryFile(entry);
        }
        logRegular(`category library website import: media fallback is ${library.categories[fallbackId].name} (${fallbackId})`);
    }

    // Persist/removal cleanup + one authoritative store update.
    writeLibrary();
    emitAssetUpdate();

    const active = getActiveCategoryEntry();
    if (active) await applyActiveCategory(active);
    emitCategoryLibraryUpdateSettled();

    logRegular(
        `category library website import complete: ${summary.imported}/${summary.total} imported, ` +
        `${summary.created} created, ${summary.updated} updated, ${summary.downloaded} media downloaded, ` +
        `${summary.not_found} 404 skipped, ${summary.failed} failed`,
    );
    emitProgress(games.length, undefined, undefined, "complete");
    return summary;
}

export async function initCategoryLibrary(bot: any) {
    // Re-read the persisted settings for startup. This avoids initializing from the
    // in-memory defaults if startup ordering changes in the future.
    const settings = readSystemConfig().category_library;
    if (!settings.enabled || !bot?.api?.channels) {
        emitCategoryLibraryUpdate();
        return;
    }

    try {
        const {getPrimaryChannel} = await import("./ConfigHelper");
        const channel = getPrimaryChannel();
        if (!channel?.id) {
            logNotice("category library initial sync skipped: primary channel is not loaded");
            emitCategoryLibraryUpdate();
            return;
        }

        const info = await bot.api.channels.getChannelInfoById(channel.id);
        if (!info?.gameId) {
            logNotice("category library initial sync skipped: channel has no category");
            emitCategoryLibraryUpdate();
            return;
        }

        const existing = getCategoryEntry(info.gameId);
        if (existing) {
            logRegular(`category library startup: found ${existing.name} (${existing.category_id})`);
        } else if (settings.auto_create) {
            logRegular(`category library startup: ${info.gameName || info.gameId} is missing, creating it`);
        } else {
            logRegular(`category library startup: ${info.gameName || info.gameId} is missing and auto-create is disabled`);
        }

        await syncTwitchCategory(bot, {
            categoryId: info.gameId,
            categoryName: info.gameName,
        });

        // syncTwitchCategory emits after a write; emit once more for the no-create
        // case so connected admin stores still receive the authoritative snapshot.
        emitCategoryLibraryUpdate();
    } catch (error: any) {
        logNotice(`category library initial sync failed: ${error?.message ?? error}`);
        emitCategoryLibraryUpdate();
    }
}
