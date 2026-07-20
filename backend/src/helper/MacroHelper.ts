import {getSystemConfigDirectory} from "./ConfigHelper";
import fs from "fs";
import path from "path";
import * as yaml from "js-yaml";
import getWebsocketServer from "../App";
import {logNotice, logRegular, logWarn} from "./LogHelper";
import {getTemplateVariables} from "./TemplateHelper";
import {redis} from "../clients/redis/Redis";
import {updateConfiguredEventIndex} from "./EventHelper";
import BaseMacroTask from "../abstracts/BaseMacroTask";
import OBSMacroTask from "./MacroTasks/OBSMacroTask";
import ApiRequestMacroTask from "./MacroTasks/ApiRequestMacroTask";
import WebsocketMacroTask from "./MacroTasks/WebsocketMacroTask";
import FunctionMacroTask from "./MacroTasks/FunctionMacroTask";
import VariableMacroTask from "./MacroTasks/VariableMacroTask";
import FileMacroTask from "./MacroTasks/FileMacroTask";
import MediaMacroTask from "./MacroTasks/MediaMacroTask";
import WledMacroTask from "./MacroTasks/WledMacroTask";
import MusicMacroTask from "./MacroTasks/MusicMacroTask";
import MacroMacroTask from "./MacroTasks/MacroMacroTask";
import WebhookMacroTask from "./MacroTasks/WebhookMacroTask";
import YoloboxMacroTask from "./MacroTasks/YoloboxMacroTask";
import NeopixelMacroTask from "./MacroTasks/NeopixelMacroTask";
import AlertMacroTask from "./MacroTasks/AlertMacroTask";
import DummyAlertMacroTask from "./MacroTasks/DummyAlertMacroTask";
import ChannelPointMacroTask from "./MacroTasks/ChannelPointMacroTask";
import TimerMacroTask from "./MacroTasks/TimerMacroTask";
import EffectMacroTask from "./MacroTasks/EffectMacroTask";
import AnimationMacroTask from "./MacroTasks/AnimationMacroTask";
import KeyboardMacroTask from "./MacroTasks/KeyboardMacroTask";
import RotateSceneMacroTask from "./MacroTasks/RotateSceneMacroTask";
import AutoMacroTask from "./MacroTasks/AutoMacroTask";
import TwitchMacroTask from "./MacroTasks/TwitchMacroTask";
import AudioMacroTask from "./MacroTasks/AudioMacroTask";
import SystemMacroTask from "./MacroTasks/SystemMacroTask";

let macros: any = {};

const MACRO_FILE_EXTENSIONS = [".yaml", ".yml", ".json"];

const macroRawMemoryCache = new Map<string, string>();

let macroTasks: Record<string, BaseMacroTask> = {}

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

    // @ts-ignore
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
    macros = {}
    macroTasks = {}

    registerMacroTasks(
        new OBSMacroTask(),
        new ApiRequestMacroTask(),
        new AudioMacroTask(),
        new WebsocketMacroTask(),
        new FunctionMacroTask(),
        new VariableMacroTask(),
        new FileMacroTask(),
        new MediaMacroTask(),
        new WledMacroTask(),
        new MusicMacroTask(),
        new MacroMacroTask({isMacroPresent, triggerMacro}),
        new WebhookMacroTask(),
        new YoloboxMacroTask(),
        new NeopixelMacroTask(),
        new AlertMacroTask(),
        new DummyAlertMacroTask(),
        new ChannelPointMacroTask(),
        new TimerMacroTask(),
        new EffectMacroTask(),
        new AnimationMacroTask(),
        new KeyboardMacroTask(),
        new RotateSceneMacroTask(),
        new AutoMacroTask(),
        new TwitchMacroTask(),
        new SystemMacroTask(),
    )

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

function registerMacroTasks(...tasks: BaseMacroTask[]) {
    for (const task of tasks) {
        macroTasks[task.getChannel()] = task;
    }
}

export function getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

export function interpolateTemplate(input: string, variables: any): string {
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

    // @ts-ignore
    if ((from < to && step < 0) || (from > to && step > 0)) {
        logWarn(`loop for step does not move from ${from} to ${to}`);
        return [];
    }

    const values = [];

    // @ts-ignore
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

            const macroTask = macroTasks[task.channel];

            if (!macroTask) {
                logWarn(`Task for the Channel ${task.channel} is invalid!`)
                continue;
            }

            const taskData = task.data ?? task;

            if (task.endpoint !== undefined && taskData && typeof taskData === "object") {
                taskData.endpoint = task.endpoint;
            }

            await macroTask.run(task.channel, task.method, taskData, variables)
        } catch (error) {
            logWarn(`task failed:`);
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        }
    }

    return true;
}


function evaluateCondition(check: any, variables: any) {
    console.log(typeof check)
    console.log(variables)
    if (typeof check !== "string" || !check.trim()) {
        return false;
    }

    const expression = check.replace(/\$\{([^}]+)\}/g, (_, path) => {
        const value = getNestedValue(variables, path.trim());

        if (typeof value === "string") {
            const normalized = value.trim().toLowerCase();

            if (normalized === "true") return "true";
            if (normalized === "false") return "false";
        }

        if (value === undefined) {
            return "undefined";
        }

        return JSON.stringify(value);
    });

    try {
        const result = Function(
            `"use strict"; return (${expression});`
        )();

        return Boolean(result);
    } catch (error) {
        return false;
    }
}

