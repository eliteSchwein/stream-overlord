import * as fs from "node:fs";
import {existsSync, mkdirSync, readdirSync, unlinkSync, watch} from "node:fs";
import {logRegular, logWarn} from "./LogHelper";
import * as path from "node:path";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
import {compressAssets, getAssetFile} from "./AssetTuneHelper";
import getWebsocketServer from "../App";
import {getConfig, getSystemConfigDirectory} from "./ConfigHelper";
import * as yaml from "js-yaml";
import {emitAssetUpdate} from "./AssetManagementHelper";
import {redis} from "../clients/redis/Redis";
import {updateConfiguredEventIndex} from "./EventHelper";
import {emitSystemStorageUpdate} from "./SystemStorageHelper";

let files = []
let assetFiles = []

const assetPath = join(getSystemConfigDirectory(), "assets")
const compressedPath = join(getSystemConfigDirectory(), "compressed_assets")

export const imageRegex = /\.(jpe?g|png)$/i
export const videoRegex = /\.(mp4|webm)$/i
export const audioRegex = /\.(mp3)$/i

const ASSET_CONFIG_FILE_EXTENSIONS = [".yaml", ".yml", ".json"];

function hasValidDuration(value: any): boolean {
    if (value === undefined || value === null || value === "") return false;

    const duration = Number(value);
    return Number.isFinite(duration) && duration >= 0;
}

function collectMediaReferences(config: any): string[] {
    const references: string[] = [];

    const addReference = (value: any) => {
        if (typeof value === "string" && value.trim()) {
            references.push(value.trim());
            return;
        }

        if (Array.isArray(value)) {
            for (const entry of value) addReference(entry);
            return;
        }

        if (!value || typeof value !== "object") return;

        for (const key of ["path", "file", "filename", "src", "asset", "url", "value"]) {
            addReference(value[key]);
        }
    };

    // Keep the requested priority: sound first, then video.
    addReference(config?.sound);
    addReference(config?.video);

    return [...new Set(references)];
}

function normalizeLocalMediaReference(reference: string): {
    root: string;
    relativePath: string;
    source: "assets" | "compressed_assets";
} | undefined {
    let normalized = String(reference || "")
        .trim()
        .replace(/\\/g, "/");

    if (!normalized) return undefined;

    // Only local filesystem-style references are allowed.
    if (
        normalized.startsWith("http://") ||
        normalized.startsWith("https://") ||
        normalized.startsWith("file://") ||
        normalized.startsWith("/api/")
    ) {
        return undefined;
    }

    normalized = normalized
        .split(/[?#]/, 1)[0]
        .replace(/^\/+/, "");

    if (!normalized) return undefined;

    if (normalized.startsWith("compressed/")) {
        return {
            root: compressedPath,
            relativePath: normalized.slice("compressed/".length),
            source: "compressed_assets",
        };
    }

    if (normalized.startsWith("compressed_assets/")) {
        return {
            root: compressedPath,
            relativePath: normalized.slice("compressed_assets/".length),
            source: "compressed_assets",
        };
    }

    if (normalized.startsWith("assets/")) {
        normalized = normalized.slice("assets/".length);
    }

    return {
        root: assetPath,
        relativePath: normalized,
        source: "assets",
    };
}

function resolveMediaFile(reference: string, assetName: string): string | undefined {

    const localReference = normalizeLocalMediaReference(reference);

    if (!localReference) {
        return undefined;
    }

    const resolved = path.resolve(localReference.root, localReference.relativePath);
    const allowedRoot = path.resolve(localReference.root);

    if (resolved !== allowedRoot && !resolved.startsWith(`${allowedRoot}${path.sep}`)) {
        logWarn(`asset duration path rejected for ${assetName}: ${resolved}`);
        return undefined;
    }

    if (!fs.existsSync(resolved)) {
        logWarn(`asset duration media file not found for ${assetName}: ${resolved}`);
        return undefined;
    }

    try {
        if (!fs.statSync(resolved).isFile()) {
            logWarn(`asset duration path is not a file for ${assetName}: ${resolved}`);
            return undefined;
        }
    } catch (error: any) {
        logWarn(`failed to stat asset duration media for ${assetName}: ${error?.message ?? error}`);
        return undefined;
    }
    return resolved;
}

function probeMediaDuration(mediaFile: string, assetName: string): number | undefined {

    const result = spawnSync("ffprobe", [
        "-v", "error",
        "-show_entries", "format=duration:stream=duration",
        "-of", "json",
        mediaFile,
    ], {
        encoding: "utf8",
        timeout: 15_000,
    });

    if (result.error) {
        logWarn(`ffprobe failed for asset ${assetName}: ${result.error.message}`);
        return undefined;
    }

    if (result.status !== 0) {
        logWarn(`ffprobe exited with status ${String(result.status)} for asset ${assetName}`);
        return undefined;
    }

    try {
        const parsed = JSON.parse(String(result.stdout || "{}"));
        const values = [
            parsed?.format?.duration,
            ...(Array.isArray(parsed?.streams) ? parsed.streams.map((stream: any) => stream?.duration) : []),
        ];

        for (const value of values) {
            const duration = Number.parseFloat(String(value));
            if (Number.isFinite(duration) && duration >= 0) {
                const roundedDuration = Math.ceil(duration);
                return roundedDuration;
            }
        }
    } catch (error: any) {
        logWarn(`failed to parse ffprobe duration for asset ${assetName}: ${error?.message ?? error}`);
    }

    logWarn(`ffprobe returned no valid duration for asset ${assetName}`);
    return undefined;
}

function addMediaDuration(assetName: string, config: any) {
    const normalized = {...config};

    if (hasValidDuration(normalized.duration)) {
        normalized.duration = Number(normalized.duration);
        return normalized;
    }

    // Never expose NaN to the frontend.
    delete normalized.duration;

    const references = collectMediaReferences(normalized);
    if (!references.length) {
        return normalized;
    }

    for (const reference of references) {
        const mediaFile = resolveMediaFile(reference, assetName);
        if (!mediaFile) continue;

        const duration = probeMediaDuration(mediaFile, assetName);
        if (duration !== undefined) {
            normalized.duration = duration;
            return normalized;
        }
    }

    logWarn(`automatic duration detection failed for asset ${assetName}`);
    return normalized;
}

let assetConfigs: Record<string, any> = {};

export type WledColorControl = {
    red?: number;
    green?: number;
    blue?: number;
    white?: number;
    effect?: number;
    color?: string;
    default_color?: string;
    [key: string]: any;
};

export type WledConfig = {
    url?: string;
    default_color?: string;
    red?: number;
    green?: number;
    blue?: number;
    white?: number;
    effect?: number;
    [key: string]: any;
};

export function getAssetConfigDirectory() {
    return path.join(getSystemConfigDirectory(), "assets_configs");
}

function ensureAssetConfigDirectory() {
    fs.mkdirSync(getAssetConfigDirectory(), {recursive: true});
}

function isAssetConfigFile(filePath: string) {
    return ASSET_CONFIG_FILE_EXTENSIONS.includes(path.extname(filePath).toLowerCase());
}

function getAssetNameFromConfigFile(filePath: string) {
    return path.basename(filePath, path.extname(filePath));
}

function sanitizeAssetConfigFileName(name: string) {
    return String(name)
            .trim()
            .replace(/[\/]+/g, "_")
            .replace(/[^a-zA-Z0-9_.-]+/g, "_")
            .replace(/^\.+/, "")
        || "asset";
}

function walkAssetConfigFiles(directory: string): string[] {
    if (!fs.existsSync(directory)) return [];

    const result: string[] = [];

    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
        const entryPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            result.push(...walkAssetConfigFiles(entryPath));
            continue;
        }

        if (entry.isFile() && isAssetConfigFile(entryPath)) {
            result.push(entryPath);
        }
    }

    return result;
}

function parseAssetConfigContent(filePath: string, content: string) {
    const extension = path.extname(filePath).toLowerCase();

    if (extension === ".json") {
        return JSON.parse(content);
    }

    return yaml.load(content) ?? {};
}

function readAssetConfigFile(filePath: string) {
    return parseAssetConfigContent(filePath, fs.readFileSync(filePath, "utf8"));
}

function getAssetCacheKey(assetName: string) {
    return `asset_${assetName}`;
}

function getAssetCacheName(filePath: string, content?: string) {
    try {
        const parsed = parseAssetConfigContent(filePath, content ?? fs.readFileSync(filePath, "utf8")) as any;
        const assetName = parsed?.name ?? getAssetNameFromConfigFile(filePath);

        return assetName ? String(assetName) : undefined;
    } catch (error) {
        return getAssetNameFromConfigFile(filePath);
    }
}

async function cacheAssetRawFile(filePath: string, content?: string) {
    const assetName = getAssetCacheName(filePath, content);

    if (!assetName) return;

    try {
        await redis.setVariable(getAssetCacheKey(assetName), content ?? fs.readFileSync(filePath, "utf8"));
    } catch (error) {
        logRegular(`failed to cache asset ${assetName}`);
    }
}

async function deleteCachedAssetRawFile(filePath: string, content?: string) {
    const assetName = getAssetCacheName(filePath, content);

    if (!assetName) return;

    try {
        await redis.deleteVariable(getAssetCacheKey(assetName));
    } catch (error) {
        logRegular(`failed to delete cached asset ${assetName}`);
    }
}

async function replaceCachedAssetRawFile(filePath: string, nextContent: string, previousContent?: string) {
    const previousAssetName = previousContent !== undefined ? getAssetCacheName(filePath, previousContent) : undefined;
    const nextAssetName = getAssetCacheName(filePath, nextContent);

    if (previousAssetName && nextAssetName && previousAssetName !== nextAssetName) {
        await deleteCachedAssetRawFile(filePath, previousContent);
    }

    await cacheAssetRawFile(filePath, nextContent);
}

function normalizeNumericWledChannel(value: any): number | undefined {
    if (value === undefined || value === null || value === "") return undefined;

    const numberValue = Number(value);

    if (!Number.isFinite(numberValue)) return undefined;

    return Math.min(255, Math.max(0, Math.round(numberValue)));
}

export function normalizeWledControls(value: any): Record<string, WledColorControl> {
    if (!value) return {};

    if (typeof value === "string") {
        return {
            default: {
                color: value,
            },
        };
    }

    if (Array.isArray(value)) {
        return value.reduce((result, entry) => ({
            ...result,
            ...normalizeWledControls(entry),
        }), {} as Record<string, WledColorControl>);
    }

    if (typeof value !== "object") return {};

    const directChannels = ["red", "green", "blue", "white", "effect"];
    const hasDirectChannels = directChannels.some(key => value[key] !== undefined) || value.color !== undefined || value.default_color !== undefined;

    if (hasDirectChannels) {
        return {
            [value.name ?? "default"]: normalizeWledControl(value),
        };
    }

    const controls: Record<string, WledColorControl> = {};

    for (const name in value) {
        controls[name] = normalizeWledControl(value[name]);
    }

    return controls;
}

function normalizeWledControl(value: any): WledColorControl {
    if (typeof value === "string") {
        return {color: value};
    }

    const control = value && typeof value === "object" ? {...value} : {};

    for (const key of ["red", "green", "blue", "white", "effect"]) {
        const normalized = normalizeNumericWledChannel(control[key]);

        if (normalized === undefined) delete control[key];
        else control[key] = normalized;
    }

    return control;
}

function normalizeAssetConfig(assetName: string, config: any = {}) {
    const normalized = addMediaDuration(assetName, {
        ...config,
        name: config?.name ?? assetName,
    });

    if (normalized.lamp_color !== undefined && normalized.wled === undefined) {
        normalized.wled = normalizeWledControls(normalized.lamp_color);
    } else {
        normalized.wled = normalizeWledControls(normalized.wled);
    }

    delete normalized.lamp_color;

    return normalized;
}

function loadAssetConfigsFromFiles() {
    ensureAssetConfigDirectory();

    for (const filePath of walkAssetConfigFiles(getAssetConfigDirectory())) {
        try {
            const assetConfig = readAssetConfigFile(filePath) as any;
            const assetName = assetConfig?.name ?? getAssetNameFromConfigFile(filePath);

            if (!assetName) continue;

            assetConfigs[assetName] = {
                ...normalizeAssetConfig(assetName, assetConfig),
                file: path.relative(getAssetConfigDirectory(), filePath).replace(/\\/g, "/"),
            };
        } catch (error) {
            logWarn(`failed to load asset config file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

export function loadAssetConfigs() {
    assetConfigs = {};

    loadAssetConfigsFromFiles();
}

export function getAssetConfig(name: string) {
    if (!Object.keys(assetConfigs).length) {
        loadAssetConfigs();
    }

    return assetConfigs[name];
}

export function getAssetConfigs() {
    if (!Object.keys(assetConfigs).length) {
        loadAssetConfigs();
    }

    return assetConfigs;
}

export function isAssetConfigPresent(name: string) {
    if (!name) return false;

    if (!Object.keys(assetConfigs).length) {
        loadAssetConfigs();
    }

    if (assetConfigs[name] !== undefined) {
        return true;
    }

    if (findAssetConfigFileByName(name)) {
        return true;
    }

    return false;
}

export function requireAssetConfigPresent(name: string) {
    if (!isAssetConfigPresent(name)) {
        throw new Error(`asset config not found: ${name}`);
    }

    return true;
}

export function getWledConfig(name: string): WledConfig | undefined {
    const configs = getConfig(/^wled /g, true);
    const config = configs?.[name];

    if (!config) return undefined;

    const normalized = {...config};

    for (const key of ["red", "green", "blue", "white", "effect"]) {
        const value = normalizeNumericWledChannel(normalized[key]);

        if (value === undefined) delete normalized[key];
        else normalized[key] = value;
    }

    return normalized;
}

export function getWledConfigs(): Record<string, WledConfig> {
    const configs = getConfig(/^wled /g, true);
    const result: Record<string, WledConfig> = {};

    for (const name in configs) {
        const normalized = getWledConfig(name);
        if (normalized) result[name] = normalized;
    }

    return result;
}

function normalizeAssetConfigPath(inputPath: string = "") {
    const normalized = path.normalize(String(inputPath || "")).replace(/^([/\\])+/, "");

    if (normalized === ".") return "";

    if (normalized.split(path.sep).includes("..")) {
        throw new Error("invalid asset config path");
    }

    return normalized;
}

function resolveAssetConfigPath(inputPath: string = "") {
    ensureAssetConfigDirectory();

    const directory = getAssetConfigDirectory();
    const resolvedPath = path.resolve(directory, normalizeAssetConfigPath(inputPath));

    if (resolvedPath !== directory && !resolvedPath.startsWith(`${directory}${path.sep}`)) {
        throw new Error("invalid asset config path");
    }

    return resolvedPath;
}

function relativeAssetConfigPath(filePath: string) {
    return path.relative(getAssetConfigDirectory(), filePath).replace(/\\/g, "/");
}

function findAssetConfigFileByName(name: string): string | undefined {
    ensureAssetConfigDirectory();

    for (const filePath of walkAssetConfigFiles(getAssetConfigDirectory())) {
        try {
            const assetConfig = readAssetConfigFile(filePath) as any;
            const assetName = assetConfig?.name ?? getAssetNameFromConfigFile(filePath);

            if (assetName === name || getAssetNameFromConfigFile(filePath) === name) {
                return filePath;
            }
        } catch (error) {
            logRegular(`failed to inspect asset config file ${filePath}`);
        }
    }

    return undefined;
}

function resolveExistingAssetConfigFile(inputPathOrName: string = "") {
    if (!inputPathOrName) {
        throw new Error("asset config path or name is required");
    }

    const normalized = normalizeAssetConfigPath(inputPathOrName);
    const directPath = resolveAssetConfigPath(normalized);

    if (fs.existsSync(directPath)) {
        return directPath;
    }

    if (!path.extname(normalized)) {
        const yamlPath = resolveAssetConfigPath(`${normalized}.yaml`);
        if (fs.existsSync(yamlPath)) return yamlPath;

        const ymlPath = resolveAssetConfigPath(`${normalized}.yml`);
        if (fs.existsSync(ymlPath)) return ymlPath;

        const jsonPath = resolveAssetConfigPath(`${normalized}.json`);
        if (fs.existsSync(jsonPath)) return jsonPath;

        const namedFilePath = findAssetConfigFileByName(normalized);
        if (namedFilePath) return namedFilePath;
    }

    throw new Error("asset config file not found");
}

function resolveEditableAssetConfigFile(inputPathOrName: string = "") {
    if (!inputPathOrName) {
        throw new Error("asset config path or name is required");
    }

    try {
        return resolveExistingAssetConfigFile(inputPathOrName);
    } catch (error) {
        const normalized = normalizeAssetConfigPath(inputPathOrName);

        if (!path.extname(normalized)) {
            return resolveAssetConfigPath(`${sanitizeAssetConfigFileName(normalized)}.yaml`);
        }

        return resolveAssetConfigPath(normalized);
    }
}

function emitAssetConfigUpdate() {
    getWebsocketServer().send("notify_assets_update", {
        assets: getAssetConfigs(),
        wled: getWledConfigs(),
    });
    emitSystemStorageUpdate()
}

export type AssetConfigFileEntry = {
    name: string;
    path: string;
    type: "file" | "directory";
    extension?: string;
};

export function listAssetConfigFiles(inputPath: string = ""): AssetConfigFileEntry[] {
    const directory = resolveAssetConfigPath(inputPath);

    if (!fs.existsSync(directory)) {
        return [];
    }

    if (!fs.statSync(directory).isDirectory()) {
        throw new Error("asset config path is not a directory");
    }

    return fs.readdirSync(directory, {withFileTypes: true})
        .filter(entry => entry.isDirectory() || (entry.isFile() && isAssetConfigFile(entry.name)))
        .map(entry => ({
            name: entry.name,
            path: path.join(normalizeAssetConfigPath(inputPath), entry.name).replace(/\\/g, "/"),
            type: entry.isDirectory() ? "directory" : "file",
            extension: entry.isFile() ? path.extname(entry.name).replace(/^\./, "") : undefined,
        }))
        .sort((a, b) => {
            if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
}

export async function readAssetConfigRawFile(inputPathOrName: string) {
    const filePath = resolveExistingAssetConfigFile(inputPathOrName);

    if (!fs.statSync(filePath).isFile()) {
        throw new Error("asset config file not found");
    }

    if (!isAssetConfigFile(filePath)) {
        throw new Error("unsupported asset config file type");
    }

    const content = fs.readFileSync(filePath, "utf8");

    await cacheAssetRawFile(filePath, content);

    return {
        path: relativeAssetConfigPath(filePath),
        content: yaml.load(content) ?? {},
    };
}

export async function editAssetConfigFile(inputPathOrName: string, content: string) {
    const filePath = resolveEditableAssetConfigFile(inputPathOrName);

    if (!isAssetConfigFile(filePath)) {
        throw new Error("asset config file must be .yaml, .yml or .json");
    }

    const previousContent = fs.existsSync(filePath) && fs.statSync(filePath).isFile()
        ? fs.readFileSync(filePath, "utf8")
        : undefined;
    const nextContent = String(content ?? "");

    if (previousContent !== undefined && !nextContent.trim()) {
        throw new Error("refusing to overwrite existing asset config with empty content");
    }

    parseAssetConfigContent(filePath, nextContent);

    fs.mkdirSync(path.dirname(filePath), {recursive: true});
    fs.writeFileSync(filePath, nextContent, "utf8");

    await replaceCachedAssetRawFile(filePath, nextContent, previousContent);

    loadAssetConfigs();
    emitAssetConfigUpdate();
    updateConfiguredEventIndex();

    return {
        path: relativeAssetConfigPath(filePath),
    };
}

export async function deleteAssetConfigFile(inputPathOrName: string) {
    const filePath = resolveExistingAssetConfigFile(inputPathOrName);
    const deletedFiles = fs.statSync(filePath).isDirectory()
        ? walkAssetConfigFiles(filePath).map(file => ({file, content: fs.readFileSync(file, "utf8")}))
        : [{file: filePath, content: fs.readFileSync(filePath, "utf8")}];

    if (fs.statSync(filePath).isDirectory()) {
        fs.rmSync(filePath, {recursive: true, force: true});
    } else {
        fs.unlinkSync(filePath);
    }

    for (const deletedFile of deletedFiles) {
        await deleteCachedAssetRawFile(deletedFile.file, deletedFile.content);
    }

    loadAssetConfigs();
    emitAssetConfigUpdate();

    return {
        path: relativeAssetConfigPath(filePath),
    };
}

export function createAssetConfigFolder(inputPath: string = "", name: string) {
    if (!name) {
        throw new Error("folder name is required");
    }

    const folderPath = resolveAssetConfigPath(path.join(inputPath, name));
    fs.mkdirSync(folderPath, {recursive: true});

    return {
        path: path.join(normalizeAssetConfigPath(inputPath), name).replace(/\\/g, "/"),
    };
}

export async function addAssetConfigFilesFromUpload(files: any[], targetPath: string = "") {
    if (!files?.length) {
        throw new Error("no files uploaded");
    }

    const directory = resolveAssetConfigPath(targetPath);
    fs.mkdirSync(directory, {recursive: true});

    const added: string[] = [];

    for (const file of files) {
        const originalName = path.basename(file.originalname || file.name || "asset.yaml");
        const extension = path.extname(originalName).toLowerCase();

        if (!ASSET_CONFIG_FILE_EXTENSIONS.includes(extension)) {
            continue;
        }

        const target = path.join(directory, originalName);

        if (!target.startsWith(`${getAssetConfigDirectory()}${path.sep}`)) {
            continue;
        }

        const previousContent = fs.existsSync(target) && fs.statSync(target).isFile()
            ? fs.readFileSync(target, "utf8")
            : undefined;
        const content = file.buffer ?? file.content ?? "";
        const stringContent = Buffer.isBuffer(content) ? content.toString("utf8") : String(content);

        fs.writeFileSync(target, content);
        await replaceCachedAssetRawFile(target, stringContent, previousContent);
        added.push(relativeAssetConfigPath(target));
    }

    loadAssetConfigs();
    emitAssetConfigUpdate();

    return added;
}

export function getParsedAssetFiles() {
    return {
        assets: getAssetConfigs(),
        wled: getWledConfigs(),
    }
}

export function readAssetFolder() {
    logRegular("reading assets folder")
    files = []
    assetFiles = []

    mkdirSync(assetPath, { recursive: true })
    loadAssetConfigs()

    readdirSync(assetPath).forEach((file) => {
        files.push(`${assetPath}/${file}`)
        assetFiles.push(getAssetFile(file))
    })
}

export function initAssetWatcher() {
    mkdirSync(assetPath, { recursive: true })
    mkdirSync(compressedPath, { recursive: true })
    ensureAssetConfigDirectory()
    loadAssetConfigs()

    watch(assetPath, {recursive: true}, async (eventType, filename) => {
        if (!filename) return
        cleanOrphanCompressedFile(filename)

        if(!existsSync(`${assetPath}/${filename}`)) return

        await compressAssets(false, `${assetPath}/${filename}`)

        readAssetFolder()

        getWebsocketServer().send("notify_assets_update", getParsedAssetFiles())
    })
}

function cleanOrphanCompressedFile(file: string) {
    const absAsset = `${assetPath}/${file}`;

    if (existsSync(absAsset)) return

    let compressedFile = file

    if(videoRegex.test(compressedFile)) compressedFile = file.replace(videoRegex, '.webm')
    if(imageRegex.test(compressedFile)) compressedFile = file.replace(imageRegex, '.webp')
    if(audioRegex.test(compressedFile)) compressedFile = file.replace(audioRegex, '.opus')

    if(compressedFile === file) return

    const absCompressed = `${compressedPath}/${compressedFile}`

    if (!existsSync(absCompressed)) return

    logRegular(`delete orphan compressed asset ${compressedFile}`)

    unlinkSync(absCompressed);

    emitAssetUpdate()
}