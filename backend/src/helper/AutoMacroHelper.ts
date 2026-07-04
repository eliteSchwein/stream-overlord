import {getConfig, getSystemConfigDirectory} from "./ConfigHelper";
import fs from "fs";
import path from "path";
import * as yaml from "js-yaml";
import {logDebug, logRegular, logSuccess, logWarn} from "./LogHelper";
import {triggerMacro} from "./MacroHelper";
import getWebsocketServer from "../App";

type AutoMacroRuntime = {
    name: string;
    enabled: boolean;
    default_enabled: boolean;
    interval: number;
    current_interval: number;
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

function normalizeIntervalSeconds(interval: any, interval_minutes?: any) {
    const rawInterval = interval ?? interval_minutes;
    const parsedInterval = Number(rawInterval);

    if (!Number.isFinite(parsedInterval) || parsedInterval <= 0) {
        return 10 * 60;
    }

    // Backwards compatibility: old config interval was minutes.
    if (interval === undefined && interval_minutes !== undefined) {
        return Math.round(parsedInterval * 60);
    }

    return Math.round(parsedInterval);
}

function normalizeAutoMacroConfig(config: any, fallbackName: string, file?: string): AutoMacroRuntime | undefined {
    const macros = normalizeMacroList(config?.macros);

    if (!macros.length) {
        logWarn(`the auto macros ${fallbackName} has no macros defined!`);
        return undefined;
    }

    const interval = normalizeIntervalSeconds(config?.interval, config?.interval_minutes);

    return {
        name: config?.name ?? fallbackName,
        enabled: config?.enabled ?? config?.default_enabled ?? false,
        default_enabled: config?.default_enabled ?? false,
        interval,
        current_interval: config?.current_interval ?? interval,
        macros,
        file,
    };
}

function loadAutoMacrosFromLegacyConfig() {
    const config = getConfig(/auto_macro /g, true);

    for (const key in config) {
        const autoMacro = normalizeAutoMacroConfig(
            {
                ...config[key],
                interval_minutes: config[key]?.interval,
            },
            key,
        );

        if (!autoMacro) continue;

        autoMacros.push(autoMacro);
        logRegular(`loaded legacy auto macros ${key}`);
    }
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
    loadAutoMacrosFromLegacyConfig();

    logSuccess(`loaded ${autoMacros.length} auto macros`);
    notifyAutoMacrosUpdate();
}

export async function updateAutoMacros() {
    for (const autoMacro of autoMacros) {
        if (!autoMacro.enabled) continue;

        autoMacro.current_interval--;

        logDebug(`update auto macro ${autoMacro.name} interval: ${autoMacro.current_interval} / ${autoMacro.interval}`);

        if (autoMacro.current_interval <= 0) {
            autoMacro.current_interval = autoMacro.interval;
            logRegular(`trigger auto macro ${autoMacro.name}`);

            for (const macro of autoMacro.macros) {
                await triggerMacro(macro);
            }
        }
    }

    notifyAutoMacrosUpdate();
}

export function toggleAutoMacro(name: string, enabled: boolean) {
    for (const autoMacro of autoMacros) {
        if (autoMacro.name !== name) continue;

        autoMacro.enabled = enabled;

        if (!enabled) {
            autoMacro.current_interval = autoMacro.interval;
        }
    }

    notifyAutoMacrosUpdate();
}

export function getAutoMacros() {
    return autoMacros;
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
    fs.writeFileSync(filePath, nextContent, "utf8");

    initAutoMacros();

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

        fs.writeFileSync(resolvedFilePath, content, "utf8");

        added.push({
            name: path.basename(resolvedFilePath),
            path: relativeAutoMacroPath(resolvedFilePath),
            type: "file",
            extension: extension.replace(/^\./, ""),
        });
    }

    initAutoMacros();

    return added;
}

export function createAutoMacroFolder(inputPath: string = "", name: string) {
    if (!name) {
        throw new Error("folder name is required");
    }

    const folderPath = resolveAutoMacroPath(path.join(inputPath, name));
    fs.mkdirSync(folderPath, {recursive: true});

    return {
        path: path.join(normalizeAutoMacroPath(inputPath), name).replace(/\\/g, "/"),
    };
}
