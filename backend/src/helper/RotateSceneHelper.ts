import {getConfig, getSystemConfigDirectory} from "./ConfigHelper";
import fs from "fs";
import path from "path";
import * as yaml from "js-yaml";
import {activateTimer, deactivateTimer, registerTimerCallback, setTimerTime} from "./TimerHelper";
import getWebsocketServer, {getOBSClient} from "../App";
import {isDebug, logDebug, logRegular, logWarn} from "./LogHelper";
import {emitSystemStorageUpdate} from "./SystemStorageHelper";

const ROTATE_SCENE_FILE_EXTENSIONS = [".yaml", ".yml", ".json"];
const ROTATE_SCENE_TIMER = "scene_rotation";

type RotateSceneFileEntry = {
    name: string;
    path: string;
    type: "file" | "directory";
    extension?: string;
};

type RotateSceneItem = {
    sceneUuid: string;
    sceneName?: string;
};

type RotateSceneConfig = {
    name?: string;
    interval?: number;
    scenes?: Array<string | RotateSceneItem>;
};

type NormalizedRotateSceneConfig = {
    name: string;
    interval: number;
    scenes: RotateSceneItem[];
    file?: string;
};

let rotatingScenes: Record<string, NormalizedRotateSceneConfig> = {};
let targetRotateSceneName: string | undefined = undefined;
let targetSceneUuid: string | undefined = undefined;
let targetSceneIndex: number | undefined = undefined;

export function getRotateSceneDirectory() {
    return path.join(getSystemConfigDirectory(), "rotating_scenes");
}

function ensureRotateSceneDirectory() {
    fs.mkdirSync(getRotateSceneDirectory(), {recursive: true});
}

function normalizeRotateScenePath(inputPath: string = "") {
    const normalized = path.normalize(inputPath).replace(/^([/\\])+/, "");

    if (normalized === ".") return "";

    if (normalized.split(path.sep).includes("..")) {
        throw new Error("invalid rotating scene path");
    }

    return normalized;
}

function resolveRotateScenePath(inputPath: string = "") {
    ensureRotateSceneDirectory();

    const rotateSceneDirectory = getRotateSceneDirectory();
    const resolvedPath = path.resolve(rotateSceneDirectory, normalizeRotateScenePath(inputPath));

    if (resolvedPath !== rotateSceneDirectory && !resolvedPath.startsWith(`${rotateSceneDirectory}${path.sep}`)) {
        throw new Error("invalid rotating scene path");
    }

    return resolvedPath;
}

function isRotateSceneFile(filePath: string) {
    return ROTATE_SCENE_FILE_EXTENSIONS.includes(path.extname(filePath).toLowerCase());
}

function getRotateSceneNameFromFile(filePath: string) {
    return path.basename(filePath, path.extname(filePath));
}

function sanitizeRotateSceneFileName(name: string) {
    return String(name)
            .trim()
            .replace(/[\\/]+/g, "_")
            .replace(/[^a-zA-Z0-9_.-]+/g, "_")
            .replace(/^\.+/, "")
        || "rotating_scene";
}

function relativeRotateScenePath(filePath: string) {
    return path.relative(getRotateSceneDirectory(), filePath).replace(/\\/g, "/");
}

function parseRotateSceneConfigContent(filePath: string, content: string) {
    const extension = path.extname(filePath).toLowerCase();

    if (extension === ".json") {
        return JSON.parse(content);
    }

    return yaml.load(content) ?? {};
}

function readRotateSceneConfigFile(filePath: string) {
    return parseRotateSceneConfigContent(filePath, fs.readFileSync(filePath, "utf8"));
}

function walkRotateSceneFiles(directory: string): string[] {
    if (!fs.existsSync(directory)) return [];

    const result: string[] = [];

    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
        const entryPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            result.push(...walkRotateSceneFiles(entryPath));
            continue;
        }

        if (entry.isFile() && isRotateSceneFile(entryPath)) {
            result.push(entryPath);
        }
    }

    return result;
}

function normalizeSceneItem(scene: string | RotateSceneItem): RotateSceneItem | undefined {
    if (typeof scene === "string") {
        return scene.trim() ? {sceneUuid: scene.trim()} : undefined;
    }

    if (!scene || typeof scene !== "object") return undefined;

    const sceneUuid = String(scene.sceneUuid ?? "").trim();
    if (!sceneUuid) return undefined;

    return {
        sceneUuid,
        sceneName: scene.sceneName,
    };
}

function normalizeRotateSceneConfig(filePath: string, config: RotateSceneConfig): NormalizedRotateSceneConfig {
    const name = String(config?.name ?? getRotateSceneNameFromFile(filePath)).trim();
    const interval = Number(config?.interval ?? 1);
    const scenes = (config?.scenes ?? [])
        .map(normalizeSceneItem)
        .filter(Boolean) as RotateSceneItem[];

    if (!name) throw new Error("rotating scene name is required");
    if (!Number.isFinite(interval) || interval <= 0) throw new Error("rotating scene interval must be greater than 0");
    if (scenes.length === 0) throw new Error("rotating scene requires at least one sceneUuid");

    return {
        name,
        interval,
        scenes,
        file: relativeRotateScenePath(filePath),
    };
}

function findRotateSceneFileByName(name: string): string | undefined {
    ensureRotateSceneDirectory();

    for (const filePath of walkRotateSceneFiles(getRotateSceneDirectory())) {
        try {
            const rotateSceneConfig = normalizeRotateSceneConfig(filePath, readRotateSceneConfigFile(filePath) as RotateSceneConfig);

            if (rotateSceneConfig.name === name || getRotateSceneNameFromFile(filePath) === name) {
                return filePath;
            }
        } catch (error) {
            logWarn(`failed to inspect rotating scene file ${filePath}`);
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        }
    }

    return undefined;
}

function resolveExistingRotateSceneFile(inputPathOrName: string = "") {
    if (!inputPathOrName) {
        throw new Error("rotating scene path or name is required");
    }

    const normalized = normalizeRotateScenePath(inputPathOrName);
    const directPath = resolveRotateScenePath(normalized);

    if (fs.existsSync(directPath)) {
        return directPath;
    }

    if (!path.extname(normalized)) {
        const yamlPath = resolveRotateScenePath(`${normalized}.yaml`);
        if (fs.existsSync(yamlPath)) return yamlPath;

        const ymlPath = resolveRotateScenePath(`${normalized}.yml`);
        if (fs.existsSync(ymlPath)) return ymlPath;

        const jsonPath = resolveRotateScenePath(`${normalized}.json`);
        if (fs.existsSync(jsonPath)) return jsonPath;

        const namedFilePath = findRotateSceneFileByName(normalized);
        if (namedFilePath) return namedFilePath;
    }

    throw new Error("rotating scene file not found");
}

function resolveEditableRotateSceneFile(inputPathOrName: string = "") {
    if (!inputPathOrName) {
        throw new Error("rotating scene path or name is required");
    }

    try {
        return resolveExistingRotateSceneFile(inputPathOrName);
    } catch (error) {
        const normalized = normalizeRotateScenePath(inputPathOrName);

        if (!path.extname(normalized)) {
            return resolveRotateScenePath(`${sanitizeRotateSceneFileName(normalized)}.yaml`);
        }

        return resolveRotateScenePath(normalized);
    }
}

function loadRotateScenesFromFiles() {
    ensureRotateSceneDirectory();

    for (const filePath of walkRotateSceneFiles(getRotateSceneDirectory())) {
        try {
            const rotateSceneConfig = normalizeRotateSceneConfig(filePath, readRotateSceneConfigFile(filePath) as RotateSceneConfig);
            rotatingScenes[rotateSceneConfig.name] = rotateSceneConfig;
        } catch (error) {
            logWarn(`failed to load rotating scene file ${filePath}`);
            logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        }
    }
}

export default function loadRotateScenes() {
    logRegular("load rotating scenes");
    rotatingScenes = {};

    loadRotateScenesFromFiles();

    getWebsocketServer().send("notify_rotating_scene_update", {rotatingScenes});
}

export function getRotateScenes() {
    return rotatingScenes;
}

export function isRotateScenePresent(name: string) {
    if (!name) return false;

    if (rotatingScenes[name] !== undefined) {
        return true;
    }

    try {
        return findRotateSceneFileByName(name) !== undefined;
    } catch (error) {
        logWarn(`failed to check if rotating scene ${name} is present`);
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        return false;
    }
}

export function listRotateSceneFiles(inputPath: string = ""): RotateSceneFileEntry[] {
    const directory = resolveRotateScenePath(inputPath);

    if (!fs.existsSync(directory)) {
        return [];
    }

    if (!fs.statSync(directory).isDirectory()) {
        throw new Error("rotating scene path is not a directory");
    }

    return fs.readdirSync(directory, {withFileTypes: true})
        .filter(entry => entry.isDirectory() || (entry.isFile() && isRotateSceneFile(entry.name)))
        .map(entry => ({
            name: entry.name,
            path: path.join(normalizeRotateScenePath(inputPath), entry.name).replace(/\\/g, "/"),
            type: entry.isDirectory() ? "directory" : "file",
            extension: entry.isFile() ? path.extname(entry.name).replace(/^\./, "") : undefined,
        }))
        .sort((a, b) => {
            if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
}

export async function readRotateSceneFile(inputPathOrName: string) {
    const filePath = resolveExistingRotateSceneFile(inputPathOrName);

    if (!fs.statSync(filePath).isFile()) {
        throw new Error("rotating scene file not found");
    }

    if (!isRotateSceneFile(filePath)) {
        throw new Error("unsupported rotating scene file type");
    }

    return {
        path: relativeRotateScenePath(filePath),
        content: fs.readFileSync(filePath, "utf8"),
    };
}

export function editRotateSceneFile(inputPathOrName: string, content: string) {
    const filePath = resolveEditableRotateSceneFile(inputPathOrName);

    if (!isRotateSceneFile(filePath)) {
        throw new Error("rotating scene file must be .yaml, .yml or .json");
    }

    const previousContent = fs.existsSync(filePath) && fs.statSync(filePath).isFile()
        ? fs.readFileSync(filePath, "utf8")
        : undefined;
    const nextContent = String(content ?? "");

    if (previousContent !== undefined && !nextContent.trim()) {
        throw new Error("refusing to overwrite existing rotating scene with empty content");
    }

    normalizeRotateSceneConfig(filePath, parseRotateSceneConfigContent(filePath, nextContent) as RotateSceneConfig);

    fs.mkdirSync(path.dirname(filePath), {recursive: true});
    fs.writeFileSync(filePath, nextContent, "utf8");

    loadRotateScenes();
    emitSystemStorageUpdate();

    return {
        path: relativeRotateScenePath(filePath),
    };
}

export async function addRotateSceneFilesFromUpload(files: any[] = [], targetPath: string = "") {
    const targetDirectory = resolveRotateScenePath(targetPath);
    const added: Array<{ name: string; path: string }> = [];

    fs.mkdirSync(targetDirectory, {recursive: true});

    for (const file of files) {
        const originalName = sanitizeRotateSceneFileName(
            file?.originalname ?? file?.name ?? "rotating_scene.yaml",
        );

        if (!isRotateSceneFile(originalName)) {
            throw new Error(`unsupported rotating scene file type: ${originalName}`);
        }

        const filePath = path.join(targetDirectory, originalName);

        if (fs.existsSync(filePath)) {
            throw new Error(`rotating scene file already exists: ${originalName}`);
        }

        const content = Buffer.isBuffer(file?.buffer)
            ? file.buffer.toString("utf8")
            : String(file?.buffer ?? file?.content ?? "");

        normalizeRotateSceneConfig(filePath, parseRotateSceneConfigContent(filePath, content) as RotateSceneConfig);

        fs.writeFileSync(filePath, content, "utf8");

        added.push({
            name: originalName,
            path: relativeRotateScenePath(filePath),
        });
    }

    loadRotateScenes();
    emitSystemStorageUpdate();

    return added;
}

export function deleteRotateSceneFile(inputPathOrName: string) {
    const filePath = resolveExistingRotateSceneFile(inputPathOrName);

    if (fs.statSync(filePath).isDirectory()) {
        fs.rmSync(filePath, {recursive: true, force: true});
    } else {
        fs.unlinkSync(filePath);
    }

    loadRotateScenes();
    emitSystemStorageUpdate();

    return {
        path: relativeRotateScenePath(filePath),
    };
}

export function moveRotateSceneFile(source: string, target: string) {
    const sourcePath = resolveRotateScenePath(source);
    const targetPath = resolveRotateScenePath(target);

    if (!fs.existsSync(sourcePath)) {
        throw new Error("source rotating scene path not found");
    }

    if (fs.existsSync(targetPath)) {
        throw new Error("target rotating scene path already exists");
    }

    fs.mkdirSync(path.dirname(targetPath), {recursive: true});
    fs.renameSync(sourcePath, targetPath);

    loadRotateScenes();
    emitSystemStorageUpdate();

    return {
        source: normalizeRotateScenePath(source).replace(/\\/g, "/"),
        target: normalizeRotateScenePath(target).replace(/\\/g, "/"),
    };
}

export function createRotateSceneFolder(inputPath: string = "", name: string) {
    if (!name) {
        throw new Error("folder name is required");
    }

    const folderPath = resolveRotateScenePath(path.join(inputPath, name));
    fs.mkdirSync(folderPath, {recursive: true});
    emitSystemStorageUpdate();

    return {
        path: path.join(normalizeRotateScenePath(inputPath), name).replace(/\\/g, "/"),
    };
}

export function stopRotateScene() {
    if (!targetRotateSceneName && !targetSceneUuid) return;

    logRegular(`stopping rotating scene`);

    targetRotateSceneName = undefined;
    targetSceneUuid = undefined;
    targetSceneIndex = undefined;

    deactivateTimer(ROTATE_SCENE_TIMER);
    registerTimerCallback(ROTATE_SCENE_TIMER, undefined);
    getWebsocketServer().send("notify_visible_element", {target: "rotating_scene", state: false});
    getWebsocketServer().send("notify_rotating_scene_runtime_update", getRotateSceneRuntimeState());
}

export function getTargetRotateScene() {
    return targetSceneUuid;
}

export function getRotateSceneRuntimeState() {
    return {
        name: targetRotateSceneName,
        sceneUuid: targetSceneUuid,
        index: targetSceneIndex,
        active: !!targetRotateSceneName,
    };
}

async function switchToRotateScene(scene: RotateSceneItem) {
    targetSceneUuid = scene.sceneUuid;

    logDebug(`rotate to scene ${scene.sceneName ?? scene.sceneUuid}`);
    await getOBSClient().send("SetCurrentProgramScene", {sceneUuid: scene.sceneUuid});

    getWebsocketServer().send("notify_rotating_scene_runtime_update", getRotateSceneRuntimeState());
}

export async function startRotateScene(name: string): Promise<boolean> {
    if (!rotatingScenes[name]) {
        loadRotateScenes();
    }

    const rotatingScene = rotatingScenes[name];

    if (!rotatingScene) return false;

    try {
        logRegular(`start rotating scene ${name}`);

        stopRotateScene();

        targetRotateSceneName = name;
        targetSceneIndex = 0;

        getWebsocketServer().send("notify_visible_element", {target: "rotating_scene", state: true});
        await switchToRotateScene(rotatingScene.scenes[targetSceneIndex]);

        registerTimerCallback(ROTATE_SCENE_TIMER, async () => {
            if (!targetRotateSceneName) return;

            targetSceneIndex = (targetSceneIndex ?? 0) + 1;

            if (!rotatingScene.scenes[targetSceneIndex]) {
                targetSceneIndex = 0;
            }

            await switchToRotateScene(rotatingScene.scenes[targetSceneIndex]);

            setTimerTime(ROTATE_SCENE_TIMER, rotatingScene.interval * 60);
            activateTimer(ROTATE_SCENE_TIMER);
        });

        setTimerTime(ROTATE_SCENE_TIMER, rotatingScene.interval * 60);
        activateTimer(ROTATE_SCENE_TIMER);
    } catch (error) {
        stopRotateScene();

        if (!isDebug()) {
            logWarn(`rotating scene ${name} failed`);
            return false;
        }

        logWarn(`rotating scene ${name} failed:`);
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        return false;
    }

    return true;
}
