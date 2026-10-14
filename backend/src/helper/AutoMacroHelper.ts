import {getConfig, getSystemConfigDirectory} from "./ConfigHelper";
import fs from "fs";
import path from "path";
import * as yaml from "js-yaml";
import {logDebug, logRegular, logSuccess, logWarn} from "./LogHelper";
import {triggerMacro} from "./MacroHelper";
import getWebsocketServer from "../App";
import {emitSystemStorageUpdate} from "./SystemStorageHelper";
function atomicWriteFileSync(filePath: string, content: string | Buffer, encoding: BufferEncoding = "utf8") {
    const directory = path.dirname(filePath);
    fs.mkdirSync(directory, {recursive: true});

    const previousMode = fs.existsSync(filePath)
        ? fs.statSync(filePath).mode & 0o777
        : undefined;
    const tempPath = path.join(
        directory,
        `.${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );

    let fd: number | undefined;

    try {
        fd = fs.openSync(tempPath, "wx");

        if (previousMode !== undefined) {
            fs.fchmodSync(fd, previousMode);
        }

        if (typeof content === "string") {
            fs.writeFileSync(fd, content, encoding);
        } else {
            fs.writeFileSync(fd, content);
        }

        fs.fsyncSync(fd);
        fs.closeSync(fd);
        fd = undefined;

        fs.renameSync(tempPath, filePath);

        const directoryFd = fs.openSync(directory, "r");
        try {
            fs.fsyncSync(directoryFd);
        } finally {
            fs.closeSync(directoryFd);
        }
    } catch (error) {
        if (fd !== undefined) {
            try {
                fs.closeSync(fd);
            } catch {
                // Ignore cleanup errors and preserve the original write error.
            }
        }

        try {
            fs.unlinkSync(tempPath);
        } catch {
            // The temp file may already have been renamed or may not exist.
        }

        throw error;
    }
}


type AutoMacroRuntime = {
    name: string;
    enabled: boolean;
    default_enabled: boolean;
    // Seconds, kept for backwards compatibility with existing frontends/configs.
    interval: number;
    current_interval: number;
    // Millisecond-native values for fast auto macros. Minimum interval is 50 ms.
    interval_ms: number;
    current_interval_ms: number;
    // Runtime-only interval override. Never persisted to the auto macro file.
    temporary_interval_ms?: number;
    temporary_interval_until?: number;
    next_run_at: number;
    macros: string[];
    file?: string;
};

type AutoMacroFileEntry = {
    name: string;
    path: string;
    type: "file" | "directory";
    extension?: string;
};

type AutoMacroUploadFile = {
    originalname?: string;
    buffer?: Buffer;
};

const AUTO_MACRO_FILE_EXTENSIONS = [".yaml", ".yml", ".json"];

let autoMacros: AutoMacroRuntime[] = [];

export function getAutoMacroDirectory() {
    return path.join(getSystemConfigDirectory(), "auto_macros");
}

function ensureAutoMacroDirectory() {
    fs.mkdirSync(getAutoMacroDirectory(), {recursive: true});
}

function normalizeAutoMacroPath(inputPath: string = "") {
    const normalized = path.normalize(inputPath).replace(/^([/\\])+/, "");

    if (normalized === ".") return "";

    if (normalized.split(path.sep).includes("..")) {
        throw new Error("invalid auto macro path");
    }

    return normalized;
}

function resolveAutoMacroPath(inputPath: string = "") {
    ensureAutoMacroDirectory();

    const autoMacroDirectory = getAutoMacroDirectory();
    const resolvedPath = path.resolve(autoMacroDirectory, normalizeAutoMacroPath(inputPath));

    if (resolvedPath !== autoMacroDirectory && !resolvedPath.startsWith(`${autoMacroDirectory}${path.sep}`)) {
        throw new Error("invalid auto macro path");
    }

    return resolvedPath;
}

function isAutoMacroFile(filePath: string) {
    return AUTO_MACRO_FILE_EXTENSIONS.includes(path.extname(filePath).toLowerCase());
}

function getAutoMacroNameFromFile(filePath: string) {
    return path.basename(filePath, path.extname(filePath));
}

function parseAutoMacroConfigContent(filePath: string, content: string) {
    const extension = path.extname(filePath).toLowerCase();

    if (extension === ".json") {
        return JSON.parse(content);
    }

    return yaml.load(content) ?? {};
}

function readAutoMacroConfigFile(filePath: string) {
    return parseAutoMacroConfigContent(filePath, fs.readFileSync(filePath, "utf8"));
}

function walkAutoMacroFiles(directory: string): string[] {
    if (!fs.existsSync(directory)) return [];

    const result: string[] = [];

    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
        const entryPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            result.push(...walkAutoMacroFiles(entryPath));
            continue;
        }

        if (entry.isFile() && isAutoMacroFile(entryPath)) {
            result.push(entryPath);
        }
    }

    return result;
}

function sanitizeAutoMacroFileName(name: string) {
    return String(name)
            .trim()
            .replace(/[\\/]+/g, "_")
            .replace(/[^a-zA-Z0-9_.-]+/g, "_")
            .replace(/^\.+/, "")
        || "auto_macro";
}

function sanitizeAutoMacroUploadFileName(name: string) {
    const extension = path.extname(name).toLowerCase();
    const baseName = path.basename(name, extension);

    return `${sanitizeAutoMacroFileName(baseName)}${extension || ".yaml"}`;
}

function relativeAutoMacroPath(filePath: string) {
    return path.relative(getAutoMacroDirectory(), filePath).replace(/\\/g, "/");
}

function normalizeMacroList(macros: any): string[] {
    if (Array.isArray(macros)) {
        return macros.map((macro) => String(macro)).filter(Boolean);
    }

    if (typeof macros === "string") {
        return macros
            .split(",")
            .map((macro) => macro.trim())
            .filter(Boolean);
    }

    return [];
}

export const MIN_AUTO_MACRO_INTERVAL_MS = 50;
const DEFAULT_AUTO_MACRO_INTERVAL_MS = 10 * 60 * 1000;

function getEffectiveAutoMacroIntervalMs(autoMacro: AutoMacroRuntime) {
    return autoMacro.temporary_interval_ms ?? autoMacro.interval_ms;
}

function clearExpiredTemporaryInterval(autoMacro: AutoMacroRuntime, now: number) {
    if (autoMacro.temporary_interval_until === undefined || autoMacro.temporary_interval_until > now) {
        return false;
    }

    autoMacro.temporary_interval_ms = undefined;
    autoMacro.temporary_interval_until = undefined;
    autoMacro.next_run_at = now + autoMacro.interval_ms;
    autoMacro.current_interval_ms = autoMacro.interval_ms;
    autoMacro.current_interval = autoMacro.interval;
    logRegular(`temporary interval expired for auto macro ${autoMacro.name}; restored ${autoMacro.interval_ms}ms`);
    return true;
}

function normalizeIntervalMilliseconds(intervalMs: any, interval: any, intervalMinutes?: any) {
    if (intervalMs !== undefined && intervalMs !== null && intervalMs !== "") {
        const parsedIntervalMs = Number(intervalMs);

        if (!Number.isFinite(parsedIntervalMs) || parsedIntervalMs <= 0) {
            return DEFAULT_AUTO_MACRO_INTERVAL_MS;
        }

        return Math.max(MIN_AUTO_MACRO_INTERVAL_MS, Math.round(parsedIntervalMs));
    }

    if (interval !== undefined && interval !== null && interval !== "") {
        const parsedIntervalSeconds = Number(interval);

        if (!Number.isFinite(parsedIntervalSeconds) || parsedIntervalSeconds <= 0) {
            return DEFAULT_AUTO_MACRO_INTERVAL_MS;
        }

        return Math.max(MIN_AUTO_MACRO_INTERVAL_MS, Math.round(parsedIntervalSeconds * 1000));
    }

    if (intervalMinutes !== undefined && intervalMinutes !== null && intervalMinutes !== "") {
        const parsedIntervalMinutes = Number(intervalMinutes);

        if (!Number.isFinite(parsedIntervalMinutes) || parsedIntervalMinutes <= 0) {
            return DEFAULT_AUTO_MACRO_INTERVAL_MS;
        }

        return Math.max(MIN_AUTO_MACRO_INTERVAL_MS, Math.round(parsedIntervalMinutes * 60_000));
    }

    return DEFAULT_AUTO_MACRO_INTERVAL_MS;
}

function normalizeAutoMacroConfig(config: any, fallbackName: string, file?: string): AutoMacroRuntime | undefined {
    const macros = normalizeMacroList(config?.macros);

    if (!macros.length) {
        logWarn(`the auto macros ${fallbackName} has no macros defined!`);
        return undefined;
    }

    const intervalMs = normalizeIntervalMilliseconds(
        config?.interval_ms,
        config?.interval,
        config?.interval_minutes,
    );
    const interval = intervalMs / 1000;
    const configuredCurrentMs = config?.current_interval_ms !== undefined
        ? Number(config.current_interval_ms)
        : config?.current_interval !== undefined
            ? Number(config.current_interval) * 1000
            : intervalMs;
    const currentIntervalMs = Number.isFinite(configuredCurrentMs) && configuredCurrentMs > 0
        ? Math.min(intervalMs, Math.max(0, Math.round(configuredCurrentMs)))
        : intervalMs;

    return {
        name: config?.name ?? fallbackName,
        enabled: config?.enabled ?? config?.default_enabled ?? false,
        default_enabled: config?.default_enabled ?? false,
        interval,
        current_interval: currentIntervalMs / 1000,
        interval_ms: intervalMs,
        current_interval_ms: currentIntervalMs,
        next_run_at: Date.now() + currentIntervalMs,
        macros,
        file,
    };
}

function loadAutoMacrosFromFiles() {
    ensureAutoMacroDirectory();

    for (const filePath of walkAutoMacroFiles(getAutoMacroDirectory())) {
        try {
            const autoMacroConfig = readAutoMacroConfigFile(filePath) as any;
            const autoMacro = normalizeAutoMacroConfig(
                autoMacroConfig,
                autoMacroConfig?.name ?? getAutoMacroNameFromFile(filePath),
                relativeAutoMacroPath(filePath),
            );

            if (!autoMacro) continue;

            autoMacros.push(autoMacro);
            logRegular(`loaded auto macros ${autoMacro.name}`);
        } catch (error) {
            logWarn(`failed to load auto macro file ${filePath}`);
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        }
    }
}

function findAutoMacroFileByName(name: string): string | undefined {
    ensureAutoMacroDirectory();

    for (const filePath of walkAutoMacroFiles(getAutoMacroDirectory())) {
        try {
            const autoMacroConfig = readAutoMacroConfigFile(filePath) as any;
            const autoMacroName = autoMacroConfig?.name ?? getAutoMacroNameFromFile(filePath);

            if (autoMacroName === name || getAutoMacroNameFromFile(filePath) === name) {
                return filePath;
            }
        } catch (error) {
            logWarn(`failed to inspect auto macro file ${filePath}`);
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        }
    }

    return undefined;
}

function resolveExistingAutoMacroFile(inputPathOrName: string = "") {
    if (!inputPathOrName) {
        throw new Error("auto macro path or name is required");
    }

    const normalized = normalizeAutoMacroPath(inputPathOrName);
    const directPath = resolveAutoMacroPath(normalized);

    if (fs.existsSync(directPath)) {
        return directPath;
    }

    if (!path.extname(normalized)) {
        const yamlPath = resolveAutoMacroPath(`${normalized}.yaml`);
        if (fs.existsSync(yamlPath)) return yamlPath;

        const ymlPath = resolveAutoMacroPath(`${normalized}.yml`);
        if (fs.existsSync(ymlPath)) return ymlPath;

        const jsonPath = resolveAutoMacroPath(`${normalized}.json`);
        if (fs.existsSync(jsonPath)) return jsonPath;

        const namedFilePath = findAutoMacroFileByName(normalized);
        if (namedFilePath) return namedFilePath;
    }

    throw new Error("auto macro file not found");
}

function resolveEditableAutoMacroFile(inputPathOrName: string = "") {
    if (!inputPathOrName) {
        throw new Error("auto macro path or name is required");
    }

    try {
        return resolveExistingAutoMacroFile(inputPathOrName);
    } catch (error) {
        const normalized = normalizeAutoMacroPath(inputPathOrName);

        if (!path.extname(normalized)) {
            return resolveAutoMacroPath(`${sanitizeAutoMacroFileName(normalized)}.yaml`);
        }

        return resolveAutoMacroPath(normalized);
    }
}

function notifyAutoMacrosUpdate() {
    getWebsocketServer().send("notify_auto_macros_update", autoMacros);
}

export function initAutoMacros() {
    logRegular("init auto macros");
    autoMacros = [];

    loadAutoMacrosFromFiles();

    logSuccess(`loaded ${autoMacros.length} auto macros`);
    notifyAutoMacrosUpdate();
}

let lastAutoMacroNotifyAt = 0;
const AUTO_MACRO_NOTIFY_INTERVAL_MS = 250;

export async function updateAutoMacros() {
    const now = Date.now();

    for (const autoMacro of autoMacros) {
        clearExpiredTemporaryInterval(autoMacro, now);

        if (!autoMacro.enabled) continue;

        const effectiveIntervalMs = getEffectiveAutoMacroIntervalMs(autoMacro);
        const remainingMs = Math.max(0, autoMacro.next_run_at - now);
        autoMacro.current_interval_ms = remainingMs;
        autoMacro.current_interval = remainingMs / 1000;

        logDebug(`update auto macro ${autoMacro.name} interval: ${autoMacro.current_interval_ms}ms / ${effectiveIntervalMs}ms`);

        if (remainingMs > 0) continue;

        // Schedule from the current wall-clock time. This intentionally avoids
        // burst catch-up if the event loop was blocked for a while.
        autoMacro.next_run_at = now + effectiveIntervalMs;
        autoMacro.current_interval_ms = effectiveIntervalMs;
        autoMacro.current_interval = effectiveIntervalMs / 1000;
        logRegular(`trigger auto macro ${autoMacro.name}`);

        for (const macro of autoMacro.macros) {
            await triggerMacro(macro);
        }
    }

    if (now - lastAutoMacroNotifyAt >= AUTO_MACRO_NOTIFY_INTERVAL_MS) {
        lastAutoMacroNotifyAt = now;
        notifyAutoMacrosUpdate();
    }
}

export function toggleAutoMacro(name: string, enabled: boolean) {
    for (const autoMacro of autoMacros) {
        if (autoMacro.name !== name) continue;

        autoMacro.enabled = enabled;

        const effectiveIntervalMs = getEffectiveAutoMacroIntervalMs(autoMacro);

        if (!enabled) {
            autoMacro.current_interval_ms = effectiveIntervalMs;
            autoMacro.current_interval = effectiveIntervalMs / 1000;
            autoMacro.next_run_at = Date.now() + effectiveIntervalMs;
        } else {
            const remainingMs = Math.max(0, autoMacro.current_interval_ms || effectiveIntervalMs);
            autoMacro.next_run_at = Date.now() + remainingMs;
        }
    }

    notifyAutoMacrosUpdate();
}

export function setTemporaryAutoMacroInterval(
    name: string,
    intervalMs: number,
    durationMs?: number,
) {
    const normalizedName = String(name ?? "").trim();
    const parsedIntervalMs = Number(intervalMs);

    if (!normalizedName) {
        throw new Error("auto macro name is required");
    }

    if (!Number.isFinite(parsedIntervalMs) || parsedIntervalMs <= 0) {
        throw new Error("auto macro interval must be greater than 0");
    }

    const autoMacro = autoMacros.find(entry => entry.name === normalizedName);
    if (!autoMacro) {
        throw new Error(`auto macro not found: ${normalizedName}`);
    }

    const normalizedIntervalMs = Math.max(MIN_AUTO_MACRO_INTERVAL_MS, Math.round(parsedIntervalMs));
    const parsedDurationMs = durationMs === undefined ? undefined : Number(durationMs);

    if (parsedDurationMs !== undefined && (!Number.isFinite(parsedDurationMs) || parsedDurationMs <= 0)) {
        throw new Error("temporary auto macro duration must be greater than 0");
    }

    const now = Date.now();
    autoMacro.temporary_interval_ms = normalizedIntervalMs;
    autoMacro.temporary_interval_until = parsedDurationMs === undefined
        ? undefined
        : now + Math.round(parsedDurationMs);
    autoMacro.current_interval_ms = normalizedIntervalMs;
    autoMacro.current_interval = normalizedIntervalMs / 1000;
    autoMacro.next_run_at = now + normalizedIntervalMs;

    logRegular(
        `temporary interval for auto macro ${autoMacro.name}: ${normalizedIntervalMs}ms`
        + (autoMacro.temporary_interval_until ? ` for ${Math.round(parsedDurationMs!)}ms` : " until reset"),
    );
    notifyAutoMacrosUpdate();

    return autoMacro;
}

export function resetTemporaryAutoMacroInterval(name: string) {
    const normalizedName = String(name ?? "").trim();

    if (!normalizedName) {
        throw new Error("auto macro name is required");
    }

    const autoMacro = autoMacros.find(entry => entry.name === normalizedName);
    if (!autoMacro) {
        throw new Error(`auto macro not found: ${normalizedName}`);
    }

    autoMacro.temporary_interval_ms = undefined;
    autoMacro.temporary_interval_until = undefined;
    autoMacro.current_interval_ms = autoMacro.interval_ms;
    autoMacro.current_interval = autoMacro.interval;
    autoMacro.next_run_at = Date.now() + autoMacro.interval_ms;

    logRegular(`reset temporary interval for auto macro ${autoMacro.name} to ${autoMacro.interval_ms}ms`);
    notifyAutoMacrosUpdate();

    return autoMacro;
}

export function getAutoMacros() {
    return autoMacros;
}

export function isAutoMacroPresent(name: string) {
    const normalized = String(name ?? "").trim();
    if (!normalized) return false;

    if (autoMacros.some((autoMacro: any) => autoMacro?.name === normalized)) {
        return true;
    }

    try {
        return findAutoMacroFileByName(normalized) !== undefined;
    } catch {
        return false;
    }
}

export function listAutoMacroFiles(inputPath: string = ""): AutoMacroFileEntry[] {
    const directory = resolveAutoMacroPath(inputPath);

    if (!fs.existsSync(directory)) {
        return [];
    }

    if (!fs.statSync(directory).isDirectory()) {
        throw new Error("auto macro path is not a directory");
    }

    return fs.readdirSync(directory, {withFileTypes: true})
        .filter(entry => entry.isDirectory() || (entry.isFile() && isAutoMacroFile(entry.name)))
        .map(entry => ({
            name: entry.name,
            path: path.join(normalizeAutoMacroPath(inputPath), entry.name).replace(/\\/g, "/"),
            type: entry.isDirectory() ? "directory" : "file",
            extension: entry.isFile() ? path.extname(entry.name).replace(/^\./, "") : undefined,
        }))
        .sort((a, b) => {
            if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
}

export function readAutoMacroFile(inputPathOrName: string) {
    const filePath = resolveExistingAutoMacroFile(inputPathOrName);

    if (!fs.statSync(filePath).isFile()) {
        throw new Error("auto macro file not found");
    }

    if (!isAutoMacroFile(filePath)) {
        throw new Error("unsupported auto macro file type");
    }

    return {
        path: relativeAutoMacroPath(filePath),
        content: fs.readFileSync(filePath, "utf8"),
    };
}

export function editAutoMacroFile(inputPathOrName: string, content: string) {
    const filePath = resolveEditableAutoMacroFile(inputPathOrName);

    if (!isAutoMacroFile(filePath)) {
        throw new Error("auto macro file must be .yaml, .yml or .json");
    }

    const previousContent = fs.existsSync(filePath) && fs.statSync(filePath).isFile()
        ? fs.readFileSync(filePath, "utf8")
        : undefined;
    const nextContent = String(content ?? "");

    if (previousContent !== undefined && !nextContent.trim()) {
        throw new Error("refusing to overwrite existing auto macro with empty content");
    }

    parseAutoMacroConfigContent(filePath, nextContent);

    fs.mkdirSync(path.dirname(filePath), {recursive: true});
    atomicWriteFileSync(filePath, nextContent, "utf8");

    initAutoMacros();
    emitSystemStorageUpdate();

    return {
        path: relativeAutoMacroPath(filePath),
    };
}

export function deleteAutoMacroFile(inputPathOrName: string) {
    const filePath = resolveExistingAutoMacroFile(inputPathOrName);

    if (fs.statSync(filePath).isDirectory()) {
        fs.rmSync(filePath, {recursive: true, force: true});
    } else {
        fs.unlinkSync(filePath);
    }

    initAutoMacros();
    emitSystemStorageUpdate();

    return {
        path: relativeAutoMacroPath(filePath),
    };
}

export function moveAutoMacroFile(source: string, target: string) {
    const sourcePath = resolveAutoMacroPath(source);
    const targetPath = resolveAutoMacroPath(target);

    if (!fs.existsSync(sourcePath)) {
        throw new Error("source auto macro path not found");
    }

    if (fs.existsSync(targetPath)) {
        throw new Error("target auto macro path already exists");
    }

    fs.mkdirSync(path.dirname(targetPath), {recursive: true});
    fs.renameSync(sourcePath, targetPath);

    initAutoMacros();
    emitSystemStorageUpdate();

    return {
        source: normalizeAutoMacroPath(source).replace(/\\/g, "/"),
        target: normalizeAutoMacroPath(target).replace(/\\/g, "/"),
    };
}

export async function addAutoMacroFilesFromUpload(files: AutoMacroUploadFile[] = [], targetPath: string = "") {
    ensureAutoMacroDirectory();

    const targetDirectory = resolveAutoMacroPath(targetPath);
    fs.mkdirSync(targetDirectory, {recursive: true});

    const added: AutoMacroFileEntry[] = [];

    for (const file of files) {
        if (!file?.buffer) continue;

        const originalName = file.originalname ?? "auto_macro.yaml";
        const fileName = sanitizeAutoMacroUploadFileName(originalName);
        const extension = path.extname(fileName).toLowerCase();

        if (!AUTO_MACRO_FILE_EXTENSIONS.includes(extension)) {
            throw new Error(`unsupported auto macro file type: ${originalName}`);
        }

        const filePath = path.join(targetDirectory, fileName);
        const resolvedFilePath = path.resolve(filePath);

        if (resolvedFilePath !== getAutoMacroDirectory() && !resolvedFilePath.startsWith(`${getAutoMacroDirectory()}${path.sep}`)) {
            throw new Error("invalid auto macro upload path");
        }

        const content = file.buffer.toString("utf8");

        parseAutoMacroConfigContent(resolvedFilePath, content);

        atomicWriteFileSync(resolvedFilePath, content, "utf8");

        added.push({
            name: path.basename(resolvedFilePath),
            path: relativeAutoMacroPath(resolvedFilePath),
            type: "file",
            extension: extension.replace(/^\./, ""),
        });
    }

    initAutoMacros();
    emitSystemStorageUpdate();

    return added;
}

export function createAutoMacroFolder(inputPath: string = "", name: string) {
    if (!name) {
        throw new Error("folder name is required");
    }

    const folderPath = resolveAutoMacroPath(path.join(inputPath, name));
    fs.mkdirSync(folderPath, {recursive: true});
    emitSystemStorageUpdate();

    return {
        path: path.join(normalizeAutoMacroPath(inputPath), name).replace(/\\/g, "/"),
    };
}
