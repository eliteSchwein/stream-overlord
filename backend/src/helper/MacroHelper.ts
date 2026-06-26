import {getConfig, getPrimaryChannel, getSystemConfigDirectory} from "./ConfigHelper";
import fs from "fs";
import path from "path";
import * as yaml from "js-yaml";
import getWebsocketServer, {getOBSClient, getTwitchClient, getYoloboxClient} from "../App";
import {logNotice, logRegular, logWarn} from "./LogHelper";
import {sleep} from "../../../helper/GeneralHelper";
import {parsePlaceholders} from "./DataHelper";
import fillTemplate, {getTemplateVariables} from "./TemplateHelper";
import {colorNeopixel} from "./NeopixelHelper";
import {toggleAutoMacro} from "./AutoMacroHelper";
import {calculateTTSduration, speak} from "./TTShelper";
import {addAlert} from "./AlertHelper";
import {getVariable, setVariable} from "./VariableHelper";
import {v4 as uuidv4} from "uuid";
import {
    addSongRequest,
    back as musicBack,
    next as musicNext,
    pause as musicPause,
    play as musicPlay,
    playSong as musicPlaySong,
    reloadMusicPlayer,
    setMusicLoop,
    setMusicLoopFile,
    setMusicShuffle,
    setRelativeVolume as musicSetRelativeVolume,
    setVolume as musicSetVolume,
    stopMusicPlayback,
    toggleMusicLoop,
    toggleMusicLoopFile,
    toggleMusicShuffle, togglePause,
    toggleSongRequest,
} from "./MusicHelper";
import {redis} from "../clients/redis/Redis";
import {getAssetConfig, getWledConfigs, normalizeWledControls} from "./AssetHelper";
import {setLedColor} from "./WledHelper";
import {toggleChannelPoint, toggleChannelPointPause} from "./ChannelPointHelper";
import {updateConfiguredEventIndex} from "./EventHelper";

let macros: any = {};

const MACRO_FILE_EXTENSIONS = [".yaml", ".yml", ".json"];


const macroRawMemoryCache = new Map<string, string>();

function getMacroCacheKey(name: string) {
    return `macro_${name}`;
}

function logMacroCacheError(action: string, cacheKey: string, error: any) {
    const errorName = error?.name ?? "";
    const errorMessage = error?.message ?? String(error ?? "unknown error");

    if (errorName === "AbortError" || /abort|timeout|timed out/i.test(errorMessage)) {
        logWarn(`macro cache ${action} skipped ${cacheKey}: redis timeout/abort`);
        return;
    }

    logWarn(`failed to ${action} macro cache ${cacheKey}`);
    logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
}

function getMacroCacheNameFromContent(filePath: string, content: string) {
    try {
        const extension = path.extname(filePath).toLowerCase();
        const macroConfig = extension === ".json"
            ? JSON.parse(content)
            : yaml.load(content) ?? {};

        return (macroConfig as any)?.name ?? getMacroNameFromFile(filePath);
    } catch (error) {
        return getMacroNameFromFile(filePath);
    }
}

function updateMacroRawCache(name: string, content: string, persist: boolean = true) {
    if (!name) return;

    const cacheKey = getMacroCacheKey(name);
    macroRawMemoryCache.set(cacheKey, content);

    if (!persist) return;

    Promise.resolve(redis.setVariable(cacheKey, content)).catch((error: any) => {
        logMacroCacheError("update", cacheKey, error);
    });
}

function deleteMacroRawCache(name: string) {
    if (!name) return;

    const cacheKey = getMacroCacheKey(name);
    macroRawMemoryCache.delete(cacheKey);

    Promise.resolve(redis.deleteVariable(cacheKey)).catch((error: any) => {
        logMacroCacheError("delete", cacheKey, error);
    });
}

function warmMacroRawCacheFromRedis(name: string) {
    if (!name) return;

    const cacheKey = getMacroCacheKey(name);

    Promise.resolve(redis.getVariable(cacheKey)).then((content: string | null | undefined) => {
        if (typeof content === "string") {
            macroRawMemoryCache.set(cacheKey, content);
        }
    }).catch((error: any) => {
        logMacroCacheError("read", cacheKey, error);
    });
}

function readMacroRawContent(filePath: string, persist: boolean = false) {
    const content = fs.readFileSync(filePath, "utf8");
    updateMacroRawCache(getMacroCacheNameFromContent(filePath, content), content, persist);
    return content;
}

async function readMacroRawContentCached(filePath: string) {
    const fileNameMacroName = getMacroNameFromFile(filePath);
    const fileNameCacheKey = getMacroCacheKey(fileNameMacroName);
    const memoryCachedFileContent = macroRawMemoryCache.get(fileNameCacheKey);

    if (memoryCachedFileContent !== undefined) {
        return memoryCachedFileContent;
    }

    try {
        const redisCachedFileContent = await redis.getVariable(fileNameCacheKey);

        if (typeof redisCachedFileContent === "string") {
            macroRawMemoryCache.set(fileNameCacheKey, redisCachedFileContent);
            return redisCachedFileContent;
        }
    } catch (error: any) {
        logMacroCacheError("read", fileNameCacheKey, error);
    }

    const content = fs.readFileSync(filePath, "utf8");
    const macroName = getMacroCacheNameFromContent(filePath, content);
    const macroCacheKey = getMacroCacheKey(macroName);

    if (macroCacheKey !== fileNameCacheKey) {
        const memoryCachedMacroContent = macroRawMemoryCache.get(macroCacheKey);

        if (memoryCachedMacroContent !== undefined) {
            return memoryCachedMacroContent;
        }

        try {
            const redisCachedMacroContent = await redis.getVariable(macroCacheKey);

            if (typeof redisCachedMacroContent === "string") {
                macroRawMemoryCache.set(macroCacheKey, redisCachedMacroContent);
                return redisCachedMacroContent;
            }
        } catch (error: any) {
            logMacroCacheError("read", macroCacheKey, error);
        }
    }

    updateMacroRawCache(macroName, content, false);

    return content;
}

type MacroFileEntry = {
    name: string;
    path: string;
    type: "file" | "directory";
    extension?: string;
};

export function getMacroDirectory() {
    return path.join(getSystemConfigDirectory(), "macros");
}

function ensureMacroDirectory() {
    fs.mkdirSync(getMacroDirectory(), {recursive: true});
}

function normalizeMacroPath(inputPath: string = "") {
    const normalized = path.normalize(inputPath).replace(/^([/\\])+/, "");

    if (normalized === ".") return "";

    if (normalized.split(path.sep).includes("..")) {
        throw new Error("invalid macro path");
    }

    return normalized;
}

function resolveMacroPath(inputPath: string = "") {
    ensureMacroDirectory();

    const macroDirectory = getMacroDirectory();
    const resolvedPath = path.resolve(macroDirectory, normalizeMacroPath(inputPath));

    if (resolvedPath !== macroDirectory && !resolvedPath.startsWith(`${macroDirectory}${path.sep}`)) {
        throw new Error("invalid macro path");
    }

    return resolvedPath;
}

function isMacroFile(filePath: string) {
    return MACRO_FILE_EXTENSIONS.includes(path.extname(filePath).toLowerCase());
}

function getMacroNameFromFile(filePath: string) {
    return path.basename(filePath, path.extname(filePath));
}

function parseMacroConfigContent(filePath: string, content: string) {
    const extension = path.extname(filePath).toLowerCase();

    if (extension === ".json") {
        return JSON.parse(content);
    }

    return yaml.load(content) ?? {};
}

function readMacroConfigFile(filePath: string) {
    return parseMacroConfigContent(filePath, readMacroRawContent(filePath));
}

function walkMacroFiles(directory: string): string[] {
    if (!fs.existsSync(directory)) return [];

    const result: string[] = [];

    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
        const entryPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            result.push(...walkMacroFiles(entryPath));
            continue;
        }

        if (entry.isFile() && isMacroFile(entryPath)) {
            result.push(entryPath);
        }
    }

    return result;
}


function sanitizeMacroFileName(name: string) {
    return String(name)
            .trim()
            .replace(/[\\/]+/g, "_")
            .replace(/[^a-zA-Z0-9_.-]+/g, "_")
            .replace(/^\.+/, "")
        || "macro";
}

function findMacroFileByName(name: string): string | undefined {
    ensureMacroDirectory();

    for (const filePath of walkMacroFiles(getMacroDirectory())) {
        try {
            const macroConfig = readMacroConfigFile(filePath) as any;
            const macroName = macroConfig?.name ?? getMacroNameFromFile(filePath);

            if (macroName === name || getMacroNameFromFile(filePath) === name) {
                return filePath;
            }
        } catch (error) {
            logWarn(`failed to inspect macro file ${filePath}`);
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        }
    }

    return undefined;
}

function resolveExistingMacroFile(inputPathOrName: string = "") {
    if (!inputPathOrName) {
        throw new Error("macro path or name is required");
    }

    const normalized = normalizeMacroPath(inputPathOrName);
    const directPath = resolveMacroPath(normalized);

    if (fs.existsSync(directPath)) {
        return directPath;
    }

    if (!path.extname(normalized)) {
        const yamlPath = resolveMacroPath(`${normalized}.yaml`);
        if (fs.existsSync(yamlPath)) return yamlPath;

        const ymlPath = resolveMacroPath(`${normalized}.yml`);
        if (fs.existsSync(ymlPath)) return ymlPath;

        const jsonPath = resolveMacroPath(`${normalized}.json`);
        if (fs.existsSync(jsonPath)) return jsonPath;

        const namedFilePath = findMacroFileByName(normalized);
        if (namedFilePath) return namedFilePath;
    }

    throw new Error("macro file not found");
}

function resolveEditableMacroFile(inputPathOrName: string = "") {
    if (!inputPathOrName) {
        throw new Error("macro path or name is required");
    }

    try {
        return resolveExistingMacroFile(inputPathOrName);
    } catch (error) {
        const normalized = normalizeMacroPath(inputPathOrName);

        if (!path.extname(normalized)) {
            return resolveMacroPath(`${sanitizeMacroFileName(normalized)}.yaml`);
        }

        return resolveMacroPath(normalized);
    }
}

function relativeMacroPath(filePath: string) {
    return path.relative(getMacroDirectory(), filePath).replace(/\\/g, "/");
}

function loadMacrosFromFiles() {
    ensureMacroDirectory();

    for (const filePath of walkMacroFiles(getMacroDirectory())) {
        try {
            const macroConfig = readMacroConfigFile(filePath) as any;
            const macroName = macroConfig?.name ?? getMacroNameFromFile(filePath);

            if (!macroName) continue;

            macros[macroName] = {
                apis: macroConfig?.apis ?? [],
                tasks: macroConfig?.tasks ?? [],
                file: relativeMacroPath(filePath),
            };
        } catch (error) {
            logWarn(`failed to load macro file ${filePath}`);
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        }
    }
}

export function listMacroFiles(inputPath: string = ""): MacroFileEntry[] {
    const directory = resolveMacroPath(inputPath);

    if (!fs.existsSync(directory)) {
        return [];
    }

    if (!fs.statSync(directory).isDirectory()) {
        throw new Error("macro path is not a directory");
    }

    return fs.readdirSync(directory, {withFileTypes: true})
        .filter(entry => entry.isDirectory() || (entry.isFile() && isMacroFile(entry.name)))
        .map(entry => ({
            name: entry.name,
            path: path.join(normalizeMacroPath(inputPath), entry.name).replace(/\\/g, "/"),
            type: entry.isDirectory() ? "directory" : "file",
            extension: entry.isFile() ? path.extname(entry.name).replace(/^\./, "") : undefined,
        }))
        .sort((a, b) => {
            if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
}

export async function readMacroFile(inputPathOrName: string) {
    const filePath = resolveExistingMacroFile(inputPathOrName);

    if (!fs.statSync(filePath).isFile()) {
        throw new Error("macro file not found");
    }

    if (!isMacroFile(filePath)) {
        throw new Error("unsupported macro file type");
    }

    return {
        path: relativeMacroPath(filePath),
        content: await readMacroRawContentCached(filePath),
    };
}

export function editMacroFile(inputPathOrName: string, content: string) {
    const filePath = resolveEditableMacroFile(inputPathOrName);

    if (!isMacroFile(filePath)) {
        throw new Error("macro file must be .yaml, .yml or .json");
    }

    const previousContent = fs.existsSync(filePath) && fs.statSync(filePath).isFile()
        ? fs.readFileSync(filePath, "utf8")
        : undefined;
    const nextContent = String(content ?? "");

    if (previousContent !== undefined && !nextContent.trim()) {
        throw new Error("refusing to overwrite existing macro with empty content");
    }

    parseMacroConfigContent(filePath, nextContent);

    fs.mkdirSync(path.dirname(filePath), {recursive: true});
    fs.writeFileSync(filePath, nextContent, "utf8");

    const macroName = getMacroCacheNameFromContent(filePath, nextContent);
    updateMacroRawCache(macroName, nextContent);

    loadMacros();
    updateConfiguredEventIndex();

    return {
        path: relativeMacroPath(filePath),
    };
}

export function deleteMacroFile(inputPathOrName: string) {
    const filePath = resolveExistingMacroFile(inputPathOrName);
    const deletedMacroNames = fs.statSync(filePath).isDirectory()
        ? walkMacroFiles(filePath).map(file => {
            try {
                return (readMacroConfigFile(file) as any)?.name ?? getMacroNameFromFile(file);
            } catch (error) {
                return getMacroNameFromFile(file);
            }
        })
        : (() => {
            try {
                return [(readMacroConfigFile(filePath) as any)?.name ?? getMacroNameFromFile(filePath)];
            } catch (error) {
                return [getMacroNameFromFile(filePath)];
            }
        })();

    if (fs.statSync(filePath).isDirectory()) {
        fs.rmSync(filePath, {recursive: true, force: true});
    } else {
        fs.unlinkSync(filePath);
    }

    for (const macroName of deletedMacroNames) {
        deleteMacroRawCache(macroName);
    }

    loadMacros();

    return {
        path: relativeMacroPath(filePath),
    };
}

export function moveMacroFile(source: string, target: string) {
    const sourcePath = resolveMacroPath(source);
    const targetPath = resolveMacroPath(target);

    if (!fs.existsSync(sourcePath)) {
        throw new Error("source macro path not found");
    }

    if (fs.existsSync(targetPath)) {
        throw new Error("target macro path already exists");
    }

    fs.mkdirSync(path.dirname(targetPath), {recursive: true});
    fs.renameSync(sourcePath, targetPath);

    if (fs.statSync(targetPath).isFile() && isMacroFile(targetPath)) {
        const content = fs.readFileSync(targetPath, "utf8");
        updateMacroRawCache(getMacroCacheNameFromContent(targetPath, content), content);
    }

    loadMacros();

    return {
        source: normalizeMacroPath(source).replace(/\\/g, "/"),
        target: normalizeMacroPath(target).replace(/\\/g, "/"),
    };
}



type MacroUploadFile = {
    originalname?: string;
    buffer?: Buffer;
};

function sanitizeMacroUploadFileName(name: string) {
    const extension = path.extname(name).toLowerCase();
    const baseName = path.basename(name, extension);

    return `${sanitizeMacroFileName(baseName)}${extension || ".yaml"}`;
}

export async function addMacroFilesFromUpload(files: MacroUploadFile[] = [], targetPath: string = "") {
    ensureMacroDirectory();

    const targetDirectory = resolveMacroPath(targetPath);
    fs.mkdirSync(targetDirectory, {recursive: true});

    const added: MacroFileEntry[] = [];

    for (const file of files) {
        if (!file?.buffer) continue;

        const originalName = file.originalname ?? "macro.yaml";
        const fileName = sanitizeMacroUploadFileName(originalName);
        const extension = path.extname(fileName).toLowerCase();

        if (!MACRO_FILE_EXTENSIONS.includes(extension)) {
            throw new Error(`unsupported macro file type: ${originalName}`);
        }

        const filePath = path.join(targetDirectory, fileName);
        const resolvedFilePath = path.resolve(filePath);

        if (resolvedFilePath !== getMacroDirectory() && !resolvedFilePath.startsWith(`${getMacroDirectory()}${path.sep}`)) {
            throw new Error("invalid macro upload path");
        }

        const content = file.buffer.toString("utf8");

        // Validate before writing so broken yaml/json uploads do not poison the macro directory.
        parseMacroConfigContent(resolvedFilePath, content);

        fs.writeFileSync(resolvedFilePath, content, "utf8");

        const macroName = getMacroCacheNameFromContent(resolvedFilePath, content);
        updateMacroRawCache(macroName, content);

        added.push({
            name: path.basename(resolvedFilePath),
            path: relativeMacroPath(resolvedFilePath),
            type: "file",
            extension: extension.replace(/^\./, ""),
        });
    }

    loadMacros();

    return added;
}

export function createMacroFolder(inputPath: string = "", name: string) {
    if (!name) {
        throw new Error("folder name is required");
    }

    const folderPath = resolveMacroPath(path.join(inputPath, name));
    fs.mkdirSync(folderPath, {recursive: true});

    return {
        path: path.join(normalizeMacroPath(inputPath), name).replace(/\\/g, "/"),
    };
}


const cancelledEvents = new Set<string>()

export function cancelMacroEvent(eventUuid: string | undefined) {
    if (!eventUuid) return
    cancelledEvents.add(eventUuid)
}

export function clearCancelledMacroEvent(eventUuid: string | undefined) {
    if (!eventUuid) return
    cancelledEvents.delete(eventUuid)
}

function isMacroEventCancelled(variables: any) {
    return variables?.eventUuid && cancelledEvents.has(variables.eventUuid)
}

export default function loadMacros() {
    logRegular("load macros");
    macros = {};

    loadMacrosFromFiles();

    getWebsocketServer().send("notify_macro_update", {macros});
}

export function getMacros() {
    return macros;
}

export function isMacroPresent(name: string) {
    if (!name) return false;

    if (macros[name] !== undefined) {
        return true;
    }

    try {
        return findMacroFileByName(name) !== undefined;
    } catch (error) {
        logWarn(`failed to check if macro ${name} is present`);
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        return false;
    }
}

export function requireMacroPresent(name: string) {
    if (!isMacroPresent(name)) {
        throw new Error(`macro not found: ${name}`);
    }

    return true;
}

function getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

function interpolateTemplate(input: string, variables: any): string {
    return input
        .replace(/"\$\{([^}]+)\}"/g, (_, variablePath) => {
            const value = getNestedValue(variables, variablePath.trim());

            if (value === undefined) {
                return JSON.stringify("");
            }

            return JSON.stringify(value);
        })
        .replace(/\$\{([^}]+)\}/g, (_, variablePath) => {
            const value = getNestedValue(variables, variablePath.trim());

            if (value === undefined || value === null) {
                return "";
            }

            if (typeof value === "object") {
                return JSON.stringify(value);
            }

            return String(value);
        });
}

function evaluateCheck(value: any, check: string = ""): boolean {
    try {
        return Boolean(Function("value", `return value ${check}`)(value));
    } catch (error) {
        logWarn(`invalid macro condition: value ${check}`);
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        return false;
    }
}

function shouldExecute(controlStack: any[]): boolean {
    return controlStack.every(block => block.active);
}

function parentsShouldExecute(controlStack: any[]): boolean {
    return controlStack.slice(0, -1).every(block => block.active);
}

function buildNumericLoopValues(data: any = {}) {
    const from = Number(data.from);
    const to = Number(data.to);
    const requestedStep = data.step === undefined ? undefined : Number(data.step);

    if (!Number.isFinite(from) || !Number.isFinite(to)) {
        logWarn(`loop for requires numeric from and to`);
        return [];
    }

    const step = Number.isFinite(requestedStep) && requestedStep !== 0
        ? requestedStep
        : from <= to ? 1 : -1;

    if ((from < to && step < 0) || (from > to && step > 0)) {
        logWarn(`loop for step does not move from ${from} to ${to}`);
        return [];
    }

    const values = [];

    for (let value = from; step > 0 ? value <= to : value >= to; value += step) {
        values.push(value);
    }

    return values;
}

function normalizeLoopDataValues(value: any) {
    if (Array.isArray(value)) {
        return value;
    }

    if (value && typeof value === "object") {
        return Object.values(value);
    }

    if (typeof value === "string" && value.trim()) {
        try {
            const parsed = JSON.parse(value);

            if (Array.isArray(parsed)) return parsed;
            if (parsed && typeof parsed === "object") return Object.values(parsed);
        } catch (error) {
            return value
                .split(",")
                .map((item: string) => item.trim())
                .filter((item: string) => item.length > 0);
        }
    }

    return [];
}

function getLoopValues(data: any = {}, variables: any = {}) {
    if (data.from !== undefined && data.to !== undefined) {
        return buildNumericLoopValues(data);
    }

    if (data.data !== undefined) {
        const loopData = typeof data.data === "string"
            ? getNestedValue(variables, data.data) ?? data.data
            : data.data;

        return normalizeLoopDataValues(loopData);
    }

    if (data.values !== undefined) {
        return normalizeLoopDataValues(data.values);
    }

    return [];
}

function setLoopVariables(block: any, variables: any) {
    variables[block.key] = block.values[block.index];
}

export async function triggerMacro(name: string, variables: any = {}) {
    if (!macros[name]) {
        return false;
    }

    if (!variables) variables = {};

    variables = {
        ...getTemplateVariables(),
        ...variables,
    };

    const macroApis = macros[name]?.apis ?? [];

    for (const macroApi of macroApis) {
        const regex = new RegExp(`api ${macroApi}`, "g");
        const apiConfig = getConfig(regex)[0];

        if (apiConfig?.url) {
            variables = {
                ...variables,
                api: {
                    ...(variables.api || {}),
                    [macroApi]: await (await fetch(apiConfig.url)).json(),
                },
            };
        }
    }

    const tasks = macros[name]?.tasks ?? [];

    logNotice(`trigger ${tasks.length} tasks from ${name} macro`);

    const controlStack: any[] = [];

    for (let taskIndex = 0; taskIndex < tasks.length; taskIndex++) {
        const preTask = tasks[taskIndex];
        if (isMacroEventCancelled(variables)) {
            logWarn(`macro ${name} cancelled for event ${variables.eventUuid}`)
            return false
        }

        try {
            const taskString = JSON.stringify(preTask);
            const interpolated = interpolateTemplate(taskString, variables);
            const task = JSON.parse(interpolated);

            if (task.channel === "condition") {
                logRegular(`test condition: ${task.method} ${task.check ?? ''}`);

                switch (task.method) {
                    case "if": {
                        const active =
                            shouldExecute(controlStack) &&
                            evaluateCondition(task.check, variables);

                        controlStack.push({
                            active,
                            branchTaken: active,
                        });

                        continue;
                    }

                    case "else_if": {
                        const block = controlStack[controlStack.length - 1];

                        if (!block) continue;

                        const parentActive = parentsShouldExecute(controlStack);

                        if (!parentActive || block.branchTaken) {
                            block.active = false;
                        } else {
                            const active = evaluateCondition(task.check, variables);

                            block.active = active;
                            block.branchTaken = active;
                        }

                        continue;
                    }

                    case "else": {
                        const block = controlStack[controlStack.length - 1];

                        if (!block) continue;

                        const parentActive = parentsShouldExecute(controlStack);

                        block.active = parentActive && !block.branchTaken;
                        block.branchTaken = true;

                        continue;
                    }

                    case "end_if": {
                        controlStack.pop();
                        continue;
                    }

                    case "end_macro": {
                        if (shouldExecute(controlStack)) {
                            return true;
                        }

                        continue;
                    }
                }
            }

            if (task.channel === "loop") {
                logRegular(`loop: ${task.method}`);

                switch (task.method) {
                    case "for": {
                        const parentActive = shouldExecute(controlStack);
                        const data = task.data ?? {};
                        const key = data.key ?? data.variable ?? "item";
                        const values = parentActive ? getLoopValues(data, variables) : [];
                        const active = parentActive && values.length > 0;

                        const block = {
                            type: "loop",
                            active,
                            key,
                            values,
                            index: 0,
                            startTaskIndex: taskIndex,
                        };

                        if (active) {
                            setLoopVariables(block, variables);
                        }

                        controlStack.push(block);
                        continue;
                    }

                    case "end_for": {
                        const block = controlStack[controlStack.length - 1];

                        if (!block || block.type !== "loop") {
                            continue;
                        }

                        block.index++;

                        if (block.index < block.values.length) {
                            setLoopVariables(block, variables);
                            taskIndex = block.startTaskIndex;
                        } else {
                            controlStack.pop();
                        }

                        continue;
                    }

                    case "break": {
                        if (!shouldExecute(controlStack)) {
                            continue;
                        }

                        const block = [...controlStack].reverse().find(item => item.type === "loop");

                        if (block) {
                            block.index = block.values.length;
                            block.active = false;
                        }

                        continue;
                    }

                    case "continue": {
                        if (!shouldExecute(controlStack)) {
                            continue;
                        }

                        const block = [...controlStack].reverse().find(item => item.type === "loop");

                        if (block) {
                            block.index++;

                            if (block.index < block.values.length) {
                                setLoopVariables(block, variables);
                                taskIndex = block.startTaskIndex;
                            } else {
                                block.index = block.values.length;
                                block.active = false;
                            }
                        }

                        continue;
                    }
                }
            }

            if (!shouldExecute(controlStack)) {
                continue;
            }

            switch (task.channel) {
                case "obs": {
                    await handleObs(task.method, task.data);
                    break;
                }

                case "rest": {
                    await handleRest(task.method, task.endpoint, task.data);
                    break;
                }

                case "websocket": {
                    handleWebsocket(task.method, task.data);
                    break;
                }

                case "function": {
                    await handleFunction(task.method, task.data, variables);
                    break;
                }

                case "variable": {
                    await handleVariable(task.method, task, variables);
                    break;
                }

                case "file": {
                    await handleFile(task.method, task.data, variables);
                    break;
                }

                case "media": {
                    handleMedia(task.method, task.data);
                    break;
                }

                case "wled": {
                    await handleWled(task.method, task.data);
                    break;
                }

                case "music": {
                    await handleMusic(task.method, task.data);
                    break;
                }

                case "macro": {
                    if (!isMacroPresent(task.method)) {
                        logWarn(`macro task skipped, macro not found: ${task.method}`);
                        break;
                    }

                    await triggerMacro(task.method, variables);
                    break;
                }

                case "webhook": {
                    await handleWebhook(task.method, task.data);
                    break;
                }

                case "yolobox": {
                    await handleYolobox(task.method, task.data);
                    break;
                }

                case "neopixel": {
                    await handleNeopixel(task.method, task.data);
                    break;
                }

                case "alert": {
                    task.eventUuid = variables.eventUuid;
                    await handleAlert(task.message, task.asset, task.eventUuid, variables);
                    break;
                }

                case "dummy_alert": {
                    await handleDummyAlert(task, variables);
                    break;
                }

                case "channel_point": {
                    await handleChannelPoint(task.method, variables.event);
                    break;
                }

                case "effect": {
                    handleEffect(task.method, task.data)
                    break
                }

                case "animation": {
                    handleAnimation(task.method, task.data)
                    break
                }

                case "keyboard": {
                    handleKeyboard(task.method, task.data);
                    break;
                }
            }
        } catch (error) {
            logWarn(`task failed:`);
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        }
    }

    return true;
}

async function handleDummyAlert(task: any, variables: any) {
    if (!task.message) {
        logWarn(`dummy_alert requires message`);
        return;
    }

    const eventUuid =
        task.event_uuid ??
        task.eventUuid ??
        variables.eventUuid ??
        `macro_${uuidv4()}`;

    const duration =
        task.duration === "tts"
            ? calculateTTSduration(task.message)
            : task.duration ?? 5;

    addAlert({
        dummy: true,
        duration: duration,
        icon: task.icon ?? "",
        message: task.message,
        "event-uuid": eventUuid,
        speak: task.speak ?? false,
    });
}

async function handleYolobox(method: string, data: any = {}) {
    logRegular(`send yolobox command: ${method}`);

    const yoloboxClient = getYoloboxClient();
    const yoloboxData = yoloboxClient?.getData();

    if (!yoloboxClient || !yoloboxData) {
        logWarn(`yolobox is currently not connected`);
        return;
    }

    if (method === "order_material_change") {
        const materialList = Array.isArray(yoloboxData.MaterialList)
            ? yoloboxData.MaterialList
            : [];

        if (!Array.isArray(yoloboxData.MaterialList)) {
            logWarn(`yolobox MaterialList is missing or invalid - skipping material change`);
            return;
        }

        for (const material of materialList) {
            if (data.id === "all" && material.isSelected !== data.isSelected) {
                yoloboxClient.sendCommand({
                    data: {
                        id: material.id,
                        isSelected: data.isSelected,
                    },
                    orderID: "order_material_change",
                });
            }

            if (material.id !== data.id) continue;
            if (material.isSelected === data.isSelected) return;
        }
    }

    if (data.id === "all") return;

    yoloboxClient.sendCommand({
        data,
        orderID: method,
    });
}

async function handleAlert(
    task: any = {},
    variables: any = {},
) {
    const message = task.message;
    const asset = task.asset;
    let eventUuid = task.event_uuid ?? task.eventUuid ?? variables.eventUuid;

    const theme = getAssetConfig(asset);

    if (!theme) {
        logWarn(`no theme found for ${asset}`);
        return;
    }

    if (!message) {
        logWarn(`no message provided`);
        return;
    }

    if (!eventUuid) {
        eventUuid = `macro_${uuidv4()}`;
    }

    addAlert({
        asset,
        sound: theme.sound,
        duration: theme.duration ?? 15,
        color: theme.color,
        icon: theme.icon,
        message,
        "event-uuid": eventUuid,
        speak: task.speak === true,
        video: theme.video,
        wled: mergeWledDefaults(theme.wled),
        volume: theme.volume,
        image: theme.image,
        channel: theme.channel,
        start_macros: theme.start_macros ?? [],
        idle_macros: theme.idle_macros ?? [],
        end_macros: theme.end_macros ?? [],
        variables: {
            ...variables,
            asset,
            eventUuid,
        },
    });
}


function mergeWledDefaults(value: any) {
    const controls = normalizeWledControls(value);
    const configs = getWledConfigs();

    const result: Record<string, any> = {};

    for (const name in controls) {
        const baseConfig = configs[name] ?? {};
        result[name] = {
            ...baseConfig,
            ...controls[name],
        };
    }

    return result;
}

async function handleWebhook(method: string = "post", data: any = {}) {
    logRegular(`send webhook`);

    if (!data.url) {
        logWarn(`webhook requires url`);
        return;
    }

    await fetch(data.url, {
        method: String(method || "post").toUpperCase(),
        headers: {
            "Content-Type": "application/json",
            ...(data.headers ?? {}),
        },
        body: String(data.content ?? ""),
    });
}

async function handleFunction(
    method: string,
    data: any = {},
    variables: any = {}
) {
    logRegular(`trigger function: ${method}`);

    switch (method) {
        case "random": {
            const min = Number(data.min);
            const max = Number(data.max);

            if (!Number.isFinite(min) || !Number.isFinite(max)) {
                logWarn(`random requires min and max`);
                break;
            }

            if (!data.key) {
                logWarn(`random requires key`);
                break;
            }

            const value =
                Math.floor(Math.random() * (max - min + 1)) + min;

            variables[data.key] = value;

            logRegular(
                `random ${data.key}=${value} (${min}-${max})`
            );

            break;
        }

        case "toggle_auto_macro": {
            if (data.name && data.enabled !== undefined) {
                toggleAutoMacro(data.name, data.enabled);
            }
            break;
        }

        case "sleep": {
            await sleep(data.time);
            break;
        }

        case "speak": {
            await speak(data.content, data.event_uuid);
            break;
        }

        case "song_request": {
            if (!data.url) {
                logWarn(`song_request requires url`);
                break;
            }

            const added = await addSongRequest(fillTemplate(data.url, data));

            if (!added) {
                logWarn(`song_request failed`);
            }

            break;
        }

        case "song_request_toggle": {
            await toggleSongRequest();
            break;
        }


        case "send_message": {
            const primaryChannel = getPrimaryChannel();

            data.content = fillTemplate(data.content, {});

            await getTwitchClient()
                .getBot()
                .api.chat.sendChatMessage(primaryChannel, data.content);

            break;
        }

        case "send_dm": {
            if (!data.user || !data.content) {
                logWarn(`send_dm requires user and content`);
                break;
            }

            const bot = getTwitchClient().getBot();

            data.content = fillTemplate(data.content, {});

            await bot.whisper(data.user, data.content);

            break;
        }
    }
}

async function handleVariable(method: string, task: any = {}, variables: any = {}) {
    const data = task.data ?? task;
    const key = data.key;

    if (!key) {
        logWarn(`variable ${method} requires key`);
        return;
    }

    switch (method) {
        case "get": {
            const value = await getVariable(key);
            variables[key] = value;

            logRegular(`variable get ${key}=${JSON.stringify(value)}`);
            break;
        }

        case "set": {
            if (data.value === undefined) {
                logWarn(`variable set requires value`);
                break;
            }

            await setVariable(key, data.value, data.to_file === true || data.toFile === true);
            variables[key] = data.value;

            logRegular(`variable set ${key}=${JSON.stringify(data.value)}`);
            break;
        }

        default: {
            logWarn(`invalid variable method: ${method}`);
            break;
        }
    }
}


function getAssetDirectory() {
    return path.join(getSystemConfigDirectory(), "assets");
}

function normalizeAssetReadPath(inputPath: string = "") {
    const normalized = path.normalize(String(inputPath || "")).replace(/^([/\\])+/, "");

    if (normalized === ".") return "";

    if (normalized.split(path.sep).includes("..")) {
        throw new Error("invalid asset path");
    }

    return normalized;
}

function resolveAssetReadPath(inputPath: string = "") {
    const baseDirectory = getAssetDirectory();
    const resolvedPath = path.resolve(baseDirectory, normalizeAssetReadPath(inputPath));

    if (resolvedPath !== baseDirectory && !resolvedPath.startsWith(`${baseDirectory}${path.sep}`)) {
        throw new Error("invalid asset path");
    }

    return resolvedPath;
}

function normalizeFileExtension(fileExtension: string = "") {
    const extension = String(fileExtension || "").trim().toLowerCase();

    if (!extension) return "";

    return extension.startsWith(".") ? extension : `.${extension}`;
}

async function handleFile(method: string, data: any = {}, variables: any = {}) {
    logRegular(`trigger file: ${method}`);

    switch (method) {
        case "read_folder": {
            const directory = resolveAssetReadPath(data.path ?? "");
            const variableKey = data.key ?? "files";
            const fileExtension = normalizeFileExtension(data.fileExtension ?? data.file_extension ?? "");

            if (!fs.existsSync(directory)) {
                logWarn(`file read_folder asset path not found: ${data.path ?? ""}`);
                variables[variableKey] = [];
                break;
            }

            if (!fs.statSync(directory).isDirectory()) {
                logWarn(`file read_folder asset path is not a directory: ${data.path ?? ""}`);
                variables[variableKey] = [];
                break;
            }

            const files = fs.readdirSync(directory, {withFileTypes: true})
                .filter(entry => entry.isFile())
                .filter(entry => !fileExtension || path.extname(entry.name).toLowerCase() === fileExtension)
                .map(entry => {
                    const relativePath = path
                        .join(normalizeAssetReadPath(data.path ?? ""), entry.name)
                        .replace(/\\/g, "/");

                    return {
                        name: entry.name,
                        path: relativePath,
                        extension: path.extname(entry.name).replace(/^\./, ""),
                    };
                })
                .sort((a, b) => a.name.localeCompare(b.name));

            variables[variableKey] = files;

            logRegular(`file read_folder ${variableKey}=${files.length} file(s)`);
            break;
        }

        default: {
            logWarn(`invalid file method: ${method}`);
            break;
        }
    }
}

function handleMedia(method: string, data: any = {}) {
    const websocket = getWebsocketServer();

    logRegular(`trigger media: ${method}`);

    switch (method) {
        case "show_media": {
            if (!data.path) {
                logWarn(`media show_media requires path`);
                break;
            }

            websocket.send("notify_media_update", {
                media: method,
                path: data.path,
                options: data.options ?? {},
            });

            break;
        }

        default: {
            logWarn(`invalid media method: ${method}`);
            break;
        }
    }
}

async function handleMusic(method: string, data: any = {}) {
    logRegular(`trigger music: ${method}`);

    switch (method) {
        case "play": {
            await musicPlay();
            break;
        }

        case "pause": {
            await musicPause();
            break;
        }

        case "toggle_pause":
        case "toggle": {
            await togglePause();
            break;
        }

        case "next": {
            await musicNext();
            break;
        }

        case "back":
        case "previous":
        case "prev": {
            await musicBack();
            break;
        }

        case "stop": {
            await stopMusicPlayback();
            break;
        }

        case "reload": {
            await reloadMusicPlayer(data.restore_state === true || data.restoreState === true);
            break;
        }

        case "volume": {
            const volume = Number(data.volume ?? data.value);

            if (!Number.isFinite(volume)) {
                logWarn(`music volume requires volume`);
                break;
            }

            await musicSetVolume(volume);
            break;
        }

        case "volume_relative":
        case "relative_volume": {
            const volume = Number(data.volume ?? data.value ?? data.delta);

            if (!Number.isFinite(volume)) {
                logWarn(`music volume_relative requires volume`);
                break;
            }

            await musicSetRelativeVolume(volume);
            break;
        }

        case "play_song":
        case "song": {
            await musicPlaySong(data);
            break;
        }

        case "shuffle": {
            if (data.enabled === undefined && data.state === undefined) {
                await toggleMusicShuffle();
            } else {
                await setMusicShuffle(data.enabled ?? data.state);
            }
            break;
        }

        case "loop":
        case "loop_playlist": {
            if (data.enabled === undefined && data.state === undefined) {
                await toggleMusicLoop();
            } else {
                await setMusicLoop(data.enabled ?? data.state);
            }
            break;
        }

        case "loop_file": {
            if (data.enabled === undefined && data.state === undefined) {
                await toggleMusicLoopFile();
            } else {
                await setMusicLoopFile(data.enabled ?? data.state);
            }
            break;
        }

        case "song_request": {
            if (!data.url) {
                logWarn(`music song_request requires url`);
                break;
            }

            const added = await addSongRequest(fillTemplate(data.url, data));

            if (!added) {
                logWarn(`music song_request failed`);
            }

            break;
        }

        case "song_request_toggle":
        case "toggle_song_request": {
            await toggleSongRequest();
            break;
        }

        default: {
            logWarn(`invalid music method: ${method}`);
            break;
        }
    }
}

async function handleObs(method: string, data: any = {}) {
    const obsClient = getOBSClient();
    const connection = data.connection ?? data.obs ?? data.target ?? 'default';

    logRegular(`trigger obs (${connection}): ${method}`);

    const obsData = {...data};
    delete obsData.connection;
    delete obsData.obs;
    delete obsData.target;

    if (method === "reload_browser_sources") {
        await obsClient.reloadAllBrowserScenes(connection);
        return;
    }

    await obsClient.send(method, obsData, connection);
}

async function handleRest(method: string, endpoint: string, data: any) {
    const config = getConfig(/^webserver/g)[0];

    logRegular(`trigger rest: ${method}`);

    const url = `http://localhost:${config.port}/api/${endpoint}`;

    await fetch(url, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            state: method,
            data,
        }),
    });
}

async function handleNeopixel(method: string, data: any) {
    if (method !== "color") {
        logWarn(`invalid neopixel method`);
        return;
    }

    if (!data.name) {
        logWarn(`neopixel name missing`);
        return;
    }

    if (!data.color) {
        logWarn(`neopixel color missing`);
        return;
    }

    await colorNeopixel(data.name, data.color, data.index);
}

async function handleChannelPoint(method: string, data: any = {}, variables: any = {}) {
    const event = variables?.event;
    const channelPointName =
        data?.name ??
        data?.label ??
        data?.channel_point ??
        data?.channelPoint ??
        variables?.channelPoint?.title ??
        variables?.channelPoint?.name ??
        event?.rewardTitle;

    const channelPoint = {
        name: channelPointName,
        label: channelPointName,
    };

    switch (method) {
        case "cancel": {
            if (!event) {
                logWarn(`channel_point cancel requires event`);
                return;
            }

            await event.updateStatus("CANCELED");
            break;
        }

        case "accept": {
            if (!event) {
                logWarn(`channel_point accept requires event`);
                return;
            }

            await event.updateStatus("FULFILLED");
            break;
        }

        case "pause": {
            if (!channelPointName) {
                logWarn(`channel_point pause requires name`);
                return;
            }

            await toggleChannelPointPause(channelPoint, true);
            break;
        }

        case "unpause": {
            if (!channelPointName) {
                logWarn(`channel_point unpause requires name`);
                return;
            }

            await toggleChannelPointPause(channelPoint, false);
            break;
        }

        case "toggle_pause": {
            if (!channelPointName) {
                logWarn(`channel_point toggle_pause requires name`);
                return;
            }

            const pause = data?.pause ?? data?.paused ?? data?.state;

            if (pause === undefined) {
                await toggleChannelPointPause(channelPoint, true);
            } else {
                await toggleChannelPointPause(channelPoint, pause === true || pause === "true" || pause === "pause" || pause === "paused");
            }

            break;
        }

        case "enable": {
            if (!channelPointName) {
                logWarn(`channel_point enable requires name`);
                return;
            }

            await toggleChannelPoint(channelPoint, true);
            break;
        }

        case "disable": {
            if (!channelPointName) {
                logWarn(`channel_point disable requires name`);
                return;
            }

            await toggleChannelPoint(channelPoint, false);
            break;
        }

        case "toggle": {
            if (!channelPointName) {
                logWarn(`channel_point toggle requires name`);
                return;
            }

            const enable = data?.enable ?? data?.enabled ?? data?.state;

            if (enable === undefined) {
                logWarn(`channel_point toggle requires state, enable or enabled`);
                return;
            }

            await toggleChannelPoint(channelPoint, enable === true || enable === "true" || enable === "enable" || enable === "enabled");
            break;
        }

        default: {
            logWarn(`invalid channel_point method: ${method}`);
            break;
        }
    }
}

function evaluateCondition(check: any, variables: any) {
    if (!check || typeof check !== "string") return false;

    const expression = check.replace(/\$\{([^}]+)\}/g, (_, path) => {
        const value = getNestedValue(variables, path.trim());

        if (typeof value === "string") {
            return value.replace(/'/g, "\\'");
        }

        if (value === undefined || value === null) {
            return "";
        }

        return String(value);
    });

    try {
        return Function(`"use strict"; return (${expression});`)() === true;
    } catch (err) {
        // @ts-ignore
        logRegular(`condition error: ${check} -> ${err['message'] ?? 'NA/'}`);
        return false;
    }
}

function handleWebsocket(method: string, data: any) {
    const websocket = getWebsocketServer();

    logRegular(`trigger websocket: ${method}`);

    websocket.send(method, data);
}

function handleEffect(method: string, data: any) {
    const websocket = getWebsocketServer()

    logRegular(`trigger effect: ${method}`)

    websocket.send('notify_effect', {
        target: data.target,
        effect: method,
        content: data.content ?? '',
        options: data.options ?? {},
    })
}

function handleKeyboard(method: string, data: any = {}) {
    const websocket = getWebsocketServer();

    logRegular(`trigger keyboard: ${method}`);

    switch (method) {
        case "press": {
            const keys = Array.isArray(data.keys)
                ? data.keys.map((key) => String(key).trim()).filter(Boolean)
                : String(data.keys ?? "")
                    .split(",")
                    .map((key) => key.trim())
                    .filter(Boolean);

            websocket.send("trigger_keyboard", {
                name: data.name ?? "macro",
                keys,
                duration: data.duration,
            });

            break;
        }

        default: {
            logWarn(`invalid keyboard method: ${method}`);
            break;
        }
    }
}

async function handleWled(method: string, data: any = {}) {
    logRegular(`trigger wled: ${method}`);

    switch (method) {
        case "custom": {
            if (!data || typeof data !== "object") {
                logWarn(`wled custom requires data`);
                return;
            }

            await setLedColor(data);
            break;
        }

        case "off": {
            await setLedColor({});
            break;
        }

        default: {
            logWarn(`invalid wled method: ${method}`);
            break;
        }
    }
}

function handleAnimation(method: string, data: any) {
    const websocket = getWebsocketServer()

    let startFrame = data.startFrame ?? data.start_frame ?? 0
    let stopFrame = data.stopFrame ?? data.stop_frame ?? null
    const reverse = data.reverse === true || data.reverse === "true"

    if (stopFrame === null || stopFrame === undefined) {
        stopFrame = data.totalFrames ?? data.total_frames ?? null
    }

    if (reverse && stopFrame !== null && startFrame < stopFrame) {
        const originalStartFrame = startFrame
        startFrame = stopFrame
        stopFrame = originalStartFrame
    }

    logRegular(`trigger animation: ${data.target} ${startFrame} -> ${stopFrame} speed: ${data.speed ?? 1} loop: ${data.loop ?? false} ${data.src ?? ''}`)

    websocket.send('notify_animation_update', {
        target: data.target,
        src: data.src,
        animation: method,
        startFrame,
        stopFrame,
        speed: data.speed ?? 1,
        loop: data.loop ?? false,
        totalFrames: data.totalFrames ?? data.total_frames,
        frameRate: data.frameRate ?? data.frame_rate,
        variables: data.variables ?? {},
    })
}