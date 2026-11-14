import axios, {AxiosError, Method} from "axios";
import {ChildProcess, spawn} from "node:child_process";
import type {WebSocket} from "ws";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import getWebsocketServer from "../App";
import {
    getOllamaIntegration,
    isOllamaIntegrationEnabled,
    setOllamaIntegrationContextSize,
    setOllamaIntegrationModel,
} from "./IntegrationsHelper";
import {logNotice, logRegular, logSuccess, logWarn} from "./LogHelper";

const OLLAMA_API_URL = "http://127.0.0.1:11434";
const OLLAMA_HOST = "127.0.0.1:11434";
const OLLAMA_NON_CHAT_TIMEOUT = 5_000;

function isExternalAiEnabled() {
    return Boolean(getOllamaIntegration().external);
}

function getExternalAiProvider() {
    return getOllamaIntegration().external_provider === "openai"
        ? "openai"
        : "ollama";
}

function isExternalOllamaEnabled() {
    return isExternalAiEnabled() && getExternalAiProvider() === "ollama";
}

function isExternalOpenAiEnabled() {
    return isExternalAiEnabled() && getExternalAiProvider() === "openai";
}

function getOllamaApi() {
    const integration = getOllamaIntegration();
    const external = isExternalOllamaEnabled();
    const externalConfig = integration.external_ollama ?? {};
    const baseURL = external
        ? String(externalConfig.url ?? "").trim().replace(/\/+$/, "")
        : OLLAMA_API_URL;

    if (external && !baseURL) {
        throw new Error("external ollama URL is not configured");
    }

    const apiKey = external
        ? String(externalConfig.api_key ?? "").trim()
        : "";

    return axios.create({
        baseURL,
        timeout: 30_000,
        headers: apiKey
            ? {Authorization: `Bearer ${apiKey}`}
            : undefined,
    });
}

function getOpenAiApi() {
    const integration = getOllamaIntegration();
    const config = integration.external_openai ?? {};
    const baseURL = String(config.url ?? "").trim().replace(/\/+$/, "");

    if (!baseURL) {
        throw new Error("OpenAI-compatible API URL is not configured");
    }

    const apiKey = String(config.api_key ?? "").trim();

    return axios.create({
        baseURL,
        timeout: 30_000,
        headers: apiKey
            ? {Authorization: `Bearer ${apiKey}`}
            : undefined,
    });
}

function getOpenAiPath(pathname: string) {
    const baseURL = String(
        getOllamaIntegration().external_openai?.url ?? "",
    ).trim().replace(/\/+$/, "");

    const path = pathname.startsWith("/")
        ? pathname
        : `/${pathname}`;

    return /\/v1$/i.test(baseURL)
        ? path.replace(/^\/v1/i, "")
        : path;
}

let ollamaProcess: ChildProcess | null = null;
let installPromise: Promise<void> | null = null;
let processTransition: Promise<void> | null = null;

const runtimeState = {
    running: false,
    installing: false,
    changing_model: false,
    external_models: [] as string[],
    error: "",
};

export type OllamaUpdate = {
    enabled: boolean;
    installed: boolean;
    running: boolean;
    installing: boolean;
    changing_model: boolean;
    model: string;
    models: string[];
    // Recommendations from meta/ollama.json for this device's RAM size.
    recommended_model: string;
    model_recommendations: Record<string, OllamaModelRecommendation>;
    // User-defined context size, 0 = automatic.
    context_size: number;
    // Recommended context size for the active model, 0 = none.
    recommended_context_size: number;
    // Context size actually sent to Ollama, 0 = Ollama default.
    effective_context_size: number;
    min_context_size: number;
    max_context_size: number;
    ram_mib: number;
    external: boolean;
    external_provider: "ollama" | "openai";
    external_url: string;
    has_api_key: boolean;
    external_ollama: {
        url: string;
        model: string;
        has_api_key: boolean;
    };
    external_openai: {
        url: string;
        model: string;
        has_api_key: boolean;
    };
    error: string;
};

export function getOllamaRoot() {
    return path.join(os.homedir(), ".local", "share", "streambot", "ollama");
}

function getOllamaBinary() {
    return path.join(getOllamaRoot(), "bin", "ollama");
}

function getInstallScript() {
    const candidates = [
        path.resolve(__dirname, "../../scripts/install_ollama.sh"),
        path.resolve(process.cwd(), "scripts/install_ollama.sh"),
    ];

    const script = candidates.find((candidate) => fs.existsSync(candidate));
    if (!script) {
        throw new Error("scripts/install_ollama.sh not found");
    }

    return script;
}

function getModelConfigPath() {
    const candidates = [
        path.resolve(__dirname, "../../meta/ollama.json"),
        path.resolve(process.cwd(), "ollama.json"),
    ];

    const config = candidates.find((candidate) => fs.existsSync(candidate));
    if (!config) {
        throw new Error("ollama.json not found");
    }

    return config;
}

function getOllamaEnvironment(): NodeJS.ProcessEnv {
    const root = getOllamaRoot();
    const runtimeHome = path.join(root, "home");
    const modelRoot = path.join(root, "models");
    const cacheRoot = path.join(root, "cache");
    const configRoot = path.join(root, "config");
    const tempRoot = path.join(root, "tmp");

    for (const directory of [
        root,
        runtimeHome,
        modelRoot,
        cacheRoot,
        configRoot,
        tempRoot,
    ]) {
        fs.mkdirSync(directory, {recursive: true});
    }

    return {
        ...process.env,
        HOME: runtimeHome,
        XDG_CACHE_HOME: cacheRoot,
        XDG_CONFIG_HOME: configRoot,
        TMPDIR: tempRoot,
        OLLAMA_MODELS: modelRoot,
        OLLAMA_HOST,
        // Vulkan backend (bundled in lib/ollama/vulkan) covers GPUs without
        // CUDA/ROCm, e.g. Intel/AMD iGPUs or the Raspberry Pi 5 (Mesa v3dv).
        OLLAMA_VULKAN: process.env.OLLAMA_VULKAN ?? "1",
        // Ollama drops integrated GPUs by default; allow them.
        OLLAMA_IGPU_ENABLE: process.env.OLLAMA_IGPU_ENABLE ?? "1",
        LD_LIBRARY_PATH: [
            path.join(root, "lib", "ollama"),
            path.join(root, "lib"),
            process.env.LD_LIBRARY_PATH,
        ].filter(Boolean).join(":"),
    };
}

function warnIfVulkanUnavailable() {
    if (process.env.OLLAMA_VULKAN === "0") {
        return;
    }

    if (!fs.existsSync(path.join(getOllamaRoot(), "lib", "ollama", "vulkan"))) {
        logWarn(
            "ollama build has no bundled vulkan backend, GPU acceleration via vulkan is unavailable",
        );
        return;
    }

    const loaderDirs = [
        "/usr/lib",
        "/usr/lib64",
        "/usr/lib/x86_64-linux-gnu",
        "/usr/lib/aarch64-linux-gnu",
        "/usr/local/lib",
    ];
    const hasLoader = loaderDirs.some((directory) =>
        fs.existsSync(path.join(directory, "libvulkan.so.1")),
    );

    if (!hasLoader) {
        logWarn(
            "vulkan loader (libvulkan.so.1) not found, install libvulkan1 and mesa-vulkan-drivers to use iGPU acceleration",
        );
    }
}

function getLocalOllamaModelRoot() {
    return path.join(getOllamaRoot(), "models");
}

function deleteLocalOllamaModels() {
    const modelRoot = getLocalOllamaModelRoot();

    if (!fs.existsSync(modelRoot)) {
        return;
    }

    try {
        fs.rmSync(
            modelRoot,
            {
                recursive: true,
                force: true,
            },
        );

        // Keep the expected directory structure available for a later switch
        // back to internal Ollama without reinstalling the runtime.
        fs.mkdirSync(
            modelRoot,
            {
                recursive: true,
            },
        );

        logSuccess(
            `deleted local ollama models from ${modelRoot}`,
        );
    } catch (error: any) {
        const message =
            error?.message ??
            "failed to delete local ollama models";

        runtimeState.error = message;

        logWarn(
            `failed to delete local ollama models: ${message}`,
        );

        throw error;
    }
}

export function isOllamaInstalled() {
    return fs.existsSync(getOllamaBinary());
}

export const OLLAMA_MIN_CONTEXT_SIZE = 512;
export const OLLAMA_MAX_CONTEXT_SIZE = 131_072;

type OllamaModelRecommendation = {
    context_size: number;
};

type OllamaRamTier = {
    // Minimum total RAM in MiB required for this tier.
    ram: number;
    recommended_model: string;
    models: Record<string, OllamaModelRecommendation>;
};

function normalizeContextSize(value: unknown) {
    const size = Number(value ?? 0);

    return Number.isFinite(size) && size > 0
        ? Math.floor(size)
        : 0;
}

function getRamMiB() {
    return Math.floor(os.totalmem() / 1024 / 1024);
}

/**
 * meta/ollama.json maps a minimum RAM size in MiB (Raspberry Pi 5 variants)
 * to the tested models of that tier:
 *
 *   "4000": {
 *     "recommended_model": "gemma3:1b",
 *     "models": {"gemma3:1b": {"context_size": 4096}}
 *   }
 *
 * The legacy format ("4000": ["gemma3:1b"]) is still accepted.
 */
function readModelTiers(): OllamaRamTier[] {
    let parsed: any;

    try {
        parsed = JSON.parse(
            fs.readFileSync(getModelConfigPath(), "utf8"),
        );
    } catch (error: any) {
        runtimeState.error =
            error?.message ?? "failed to read ollama.json";

        return [];
    }

    if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
    ) {
        return [];
    }

    const tiers: OllamaRamTier[] = [];

    for (const [ramKey, entry] of Object.entries<any>(parsed)) {
        const ram = Number(ramKey);

        if (!Number.isFinite(ram)) continue;

        const models: Record<string, OllamaModelRecommendation> = {};

        if (Array.isArray(entry)) {
            for (const model of entry) {
                const name = String(model ?? "").trim();
                if (name) models[name] = {context_size: 0};
            }
        } else if (entry && typeof entry === "object") {
            for (const [model, config] of Object.entries<any>(entry.models ?? {})) {
                const name = String(model ?? "").trim();
                if (!name) continue;

                models[name] = {
                    context_size: normalizeContextSize(config?.context_size),
                };
            }
        } else {
            continue;
        }

        tiers.push({
            ram,
            recommended_model: String(
                Array.isArray(entry) ? "" : entry.recommended_model ?? "",
            ).trim(),
            models,
        });
    }

    return tiers.sort((a, b) => a.ram - b.ram);
}

function getEligibleModelTiers() {
    const ramMiB = getRamMiB();

    return readModelTiers().filter(({ram}) => ram <= ramMiB);
}

/**
 * Recommendations for all models available on this device. Higher RAM tiers
 * override the context size recommended by lower tiers.
 */
function getModelRecommendations() {
    const recommendations: Record<string, OllamaModelRecommendation> = {};

    for (const tier of getEligibleModelTiers()) {
        for (const [model, recommendation] of Object.entries(tier.models)) {
            recommendations[model] = {
                context_size:
                    recommendation.context_size ||
                    recommendations[model]?.context_size ||
                    0,
            };
        }
    }

    return recommendations;
}

function getRecommendedOllamaModel() {
    const tiers = getEligibleModelTiers();

    for (let i = tiers.length - 1; i >= 0; i--) {
        const model = tiers[i].recommended_model;

        if (model && tiers[i].models[model]) {
            return model;
        }
    }

    return "";
}

function getRecommendedContextSize(model: string) {
    if (isExternalAiEnabled()) return 0;

    return getModelRecommendations()[model]?.context_size ?? 0;
}

/**
 * Context size used for Ollama requests: the user-defined value wins,
 * otherwise the recommendation for the model (internal Ollama only),
 * otherwise 0 which lets Ollama use its own default.
 */
export function getEffectiveOllamaContextSize(
    model = String(getOllamaIntegration().model ?? "").trim(),
) {
    if (isExternalOpenAiEnabled()) return 0;

    return (
        normalizeContextSize(getOllamaIntegration().context_size) ||
        getRecommendedContextSize(model)
    );
}

function withContextSize(
    data: any,
    contextSize: number,
) {
    if (
        contextSize <= 0 ||
        normalizeContextSize(data?.options?.num_ctx) > 0
    ) {
        return data;
    }

    return {
        ...data,
        options: {
            ...(data?.options ?? {}),
            num_ctx: contextSize,
        },
    };
}

export function getAvailableOllamaModels() {
    if (isExternalAiEnabled()) {
        return [...runtimeState.external_models];
    }

    return Object.keys(getModelRecommendations());
}

export function getOllamaUpdate(): OllamaUpdate {
    const integration = getOllamaIntegration();
    const model = String(integration.model ?? "").trim();
    const external = isExternalAiEnabled();

    return {
        enabled: Boolean(integration.enabled),
        installed: Boolean(integration.external) || isOllamaInstalled(),
        running: runtimeState.running,
        installing: runtimeState.installing,
        changing_model: runtimeState.changing_model,
        model,
        models: getAvailableOllamaModels(),
        recommended_model: external ? "" : getRecommendedOllamaModel(),
        model_recommendations: external ? {} : getModelRecommendations(),
        context_size: normalizeContextSize(integration.context_size),
        recommended_context_size: getRecommendedContextSize(model),
        effective_context_size: getEffectiveOllamaContextSize(model),
        min_context_size: OLLAMA_MIN_CONTEXT_SIZE,
        max_context_size: OLLAMA_MAX_CONTEXT_SIZE,
        ram_mib: getRamMiB(),
        external: Boolean(integration.external),
        external_provider: getExternalAiProvider(),
        external_url: String(
            getExternalAiProvider() === "openai"
                ? integration.external_openai?.url ?? ""
                : integration.external_ollama?.url ?? "",
        ),
        has_api_key: Boolean(
            getExternalAiProvider() === "openai"
                ? integration.external_openai?.api_key
                : integration.external_ollama?.api_key,
        ),
        external_ollama: {
            url: String(integration.external_ollama?.url ?? ""),
            model: String(integration.external_ollama?.model ?? ""),
            has_api_key: Boolean(integration.external_ollama?.api_key),
        },
        external_openai: {
            url: String(integration.external_openai?.url ?? ""),
            model: String(integration.external_openai?.model ?? ""),
            has_api_key: Boolean(integration.external_openai?.api_key),
        },
        error: runtimeState.error,
    };
}

export function emitOllamaUpdate(connection?: WebSocket) {
    getWebsocketServer()?.send(
        "notify_ollama_update",
        getOllamaUpdate(),
        connection,
    );
}

function logChildOutput(
    prefix: string,
    chunk: any,
    warn = false,
) {
    const lines = String(chunk ?? "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    for (const line of lines) {
        if (warn) {
            logNotice(`${prefix}: ${line}`);
        } else {
            logRegular(`${prefix}: ${line}`);
        }
    }
}

function runProcess(
    command: string,
    args: string[],
    env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            env,
            stdio: ["ignore", "pipe", "pipe"],
        });

        child.stdout?.on(
            "data",
            (chunk) => logChildOutput("ollama install", chunk),
        );

        child.stderr?.on(
            "data",
            (chunk) => logChildOutput(
                "ollama install",
                chunk,
                true,
            ),
        );

        child.once("error", reject);

        child.once("exit", (code, signal) => {
            if (code === 0) {
                resolve();
                return;
            }

            reject(
                new Error(
                    `ollama installer exited with ${
                        code ??
                        signal ??
                        "unknown status"
                    }`,
                ),
            );
        });
    });
}

export async function installOllama(force = false) {
    if (!force && isOllamaInstalled()) return;
    if (installPromise) return installPromise;

    installPromise = (async () => {
        runtimeState.installing = true;
        runtimeState.error = "";
        emitOllamaUpdate();

        try {
            const script = getInstallScript();

            logRegular(`install ollama from ${script}`);

            await runProcess(
                "bash",
                [script],
            );

            if (!isOllamaInstalled()) {
                throw new Error(
                    "ollama installer finished but bin/ollama is missing",
                );
            }

            logSuccess("ollama installation is ready");
        } catch (error: any) {
            runtimeState.error =
                error?.message ??
                "ollama installation failed";

            throw error;
        } finally {
            runtimeState.installing = false;
            installPromise = null;
            emitOllamaUpdate();
        }
    })();

    return installPromise;
}

async function waitForOllama(timeoutMs = 30_000) {
    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
        try {
            await getOllamaApi().get(
                "/api/tags",
                {
                    timeout: 1_500,
                },
            );

            return;
        } catch {
            await new Promise(
                (resolve) =>
                    setTimeout(resolve, 250),
            );
        }
    }

    throw new Error(
        "ollama server did not become ready",
    );
}

async function startOllamaInternal() {
    if (
        runtimeState.running &&
        ollamaProcess &&
        !ollamaProcess.killed
    ) {
        return;
    }

    if (!isOllamaIntegrationEnabled()) {
        return;
    }

    if (isExternalAiEnabled()) {
        deleteLocalOllamaModels();

        if (isExternalOpenAiEnabled()) {
            await refreshExternalOpenAiState();
            return;
        }

        await refreshExternalOllamaState();
        await preloadConfiguredOllamaModel();
        return;
    }

    await installOllama(false);

    warnIfVulkanUnavailable();

    const binary = getOllamaBinary();

    const child = spawn(
        binary,
        ["serve"],
        {
            env: getOllamaEnvironment(),
            stdio: ["ignore", "pipe", "pipe"],
        },
    );

    ollamaProcess = child;
    runtimeState.error = "";

    child.stdout?.on(
        "data",
        (chunk) =>
            logChildOutput(
                "ollama",
                chunk,
            ),
    );

    child.stderr?.on(
        "data",
        (chunk) =>
            logChildOutput(
                "ollama",
                chunk,
            ),
    );

    child.once(
        "spawn",
        () => {
            runtimeState.running = true;

            logSuccess(
                `ollama server started with pid ${child.pid}`,
            );

            emitOllamaUpdate();
        },
    );

    child.once(
        "error",
        (error) => {
            runtimeState.error = error.message;
            runtimeState.running = false;

            if (ollamaProcess === child) {
                ollamaProcess = null;
            }

            emitOllamaUpdate();
        },
    );

    child.once(
        "exit",
        (code, signal) => {
            runtimeState.running = false;

            if (ollamaProcess === child) {
                ollamaProcess = null;
            }

            if (code && code !== 0) {
                runtimeState.error =
                    `ollama exited with ${
                        code ??
                        signal ??
                        "unknown status"
                    }`;

                logWarn(runtimeState.error);
            }

            emitOllamaUpdate();
        },
    );

    try {
        await waitForOllama();
        await preloadConfiguredOllamaModel();
    } catch (error: any) {
        runtimeState.running = false;
        runtimeState.error =
            error?.message ??
            "ollama server did not become ready";

        logWarn(
            `ollama startup failed: ${runtimeState.error}`,
        );

        emitOllamaUpdate();
        return;
    }
}

export async function startOllama() {
    if (processTransition) {
        return processTransition;
    }

    processTransition =
        startOllamaInternal()
            .finally(() => {
                processTransition = null;
            });

    return processTransition;
}

async function unloadConfiguredExternalOllamaModel() {
    if (!isExternalOllamaEnabled()) return;

    const model = String(
        getOllamaIntegration().model ?? "",
    ).trim();

    if (!model) return;

    logRegular(
        `unload external ollama model ${model}`,
    );

    try {
        await getOllamaApi().post(
            "/api/generate",
            {
                model,
                keep_alive: 0,
            },
            {
                timeout: OLLAMA_NON_CHAT_TIMEOUT,
            },
        );

        logSuccess(
            `external ollama model ${model} is unloaded`,
        );
    } catch (error) {
        const normalizedError =
            normalizeAxiosError(error);

        logWarn(
            `failed to unload external ollama model ${model}: ${normalizedError.message}`,
        );
    }
}

async function stopOllamaInternal() {
    if (isExternalAiEnabled()) {
        if (isExternalOllamaEnabled()) {
            await unloadConfiguredExternalOllamaModel();
        }

        runtimeState.running = false;
        emitOllamaUpdate();

        return;
    }

    const child = ollamaProcess;

    if (!child) {
        runtimeState.running = false;
        emitOllamaUpdate();

        return;
    }

    await new Promise<void>((resolve) => {
        let finished = false;

        let killTimer:
            NodeJS.Timeout |
            null = null;

        const done = () => {
            if (finished) return;

            finished = true;

            if (killTimer) {
                clearTimeout(killTimer);
            }

            resolve();
        };

        child.once(
            "exit",
            done,
        );

        try {
            child.kill("SIGTERM");
        } catch {
            done();
            return;
        }

        killTimer = setTimeout(
            () => {
                try {
                    if (
                        child.exitCode === null &&
                        child.signalCode === null
                    ) {
                        child.kill("SIGKILL");
                    }
                } catch {
                    // ignored, process is already gone
                }

                done();
            },
            5_000,
        );

        killTimer.unref();
    });

    if (ollamaProcess === child) {
        ollamaProcess = null;
    }

    runtimeState.running = false;

    emitOllamaUpdate();
}

export async function stopOllama() {
    if (processTransition) {
        await processTransition.catch(
            () => undefined,
        );
    }

    processTransition =
        stopOllamaInternal()
            .finally(() => {
                processTransition = null;
            });

    return processTransition;
}

export async function purgeOllama() {
    await stopOllama();

    // Wait for an active installer before deleting
    // the Ollama directory.
    //
    // This avoids the install process recreating
    // files while we purge them.
    if (installPromise) {
        await installPromise.catch(
            () => undefined,
        );
    }

    const root = getOllamaRoot();

    try {
        fs.rmSync(
            root,
            {
                recursive: true,
                force: true,
            },
        );

        runtimeState.running = false;
        runtimeState.installing = false;
        runtimeState.changing_model = false;
        runtimeState.error = "";

        logSuccess(
            `ollama purged from ${root}`,
        );
    } catch (error: any) {
        runtimeState.error =
            error?.message ??
            "failed to purge ollama";

        emitOllamaUpdate();

        throw error;
    }

    emitOllamaUpdate();

    return getOllamaUpdate();
}

export async function restartOllama() {
    if (!isOllamaIntegrationEnabled()) {
        throw new Error(
            "ollama integration is disabled",
        );
    }

    if (isExternalAiEnabled()) {
        deleteLocalOllamaModels();

        if (isExternalOpenAiEnabled()) {
            await refreshExternalOpenAiState();
            return getOllamaUpdate();
        }

        await refreshExternalOllamaState();
        await preloadConfiguredOllamaModel();
        return getOllamaUpdate();
    }

    await stopOllama();
    await startOllama();

    return getOllamaUpdate();
}

export async function syncOllamaIntegration(
    forceInstall = false,
) {
    if (!isOllamaIntegrationEnabled()) {
        await purgeOllama();
        runtimeState.external_models = [];
        return getOllamaUpdate();
    }

    if (isExternalAiEnabled()) {
        deleteLocalOllamaModels();

        if (isExternalOpenAiEnabled()) {
            await refreshExternalOpenAiState();
            return getOllamaUpdate();
        }

        await refreshExternalOllamaState();
        await preloadConfiguredOllamaModel();
        return getOllamaUpdate();
    }

    const wasInstalled =
        isOllamaInstalled();

    runtimeState.external_models = [];

    await installOllama(
        forceInstall ||
        !wasInstalled,
    );

    await startOllama();

    // Always ensure the remembered internal model exists. External mode removes
    // local model files to save storage but deliberately keeps the Ollama runtime,
    // so checking only whether the binary was installed is not sufficient here.
    await pullConfiguredOllamaModel();
    await preloadConfiguredOllamaModel();

    return getOllamaUpdate();
}

async function preloadConfiguredOllamaModel() {
    if (isExternalOpenAiEnabled()) {
        return;
    }

    const integration = getOllamaIntegration();
    const model = String(
        integration.model ?? "",
    ).trim();

    if (!model) return;

    if (
        isExternalOllamaEnabled() &&
        runtimeState.external_models.length > 0 &&
        !runtimeState.external_models.includes(model)
    ) {
        logWarn(
            `configured external ollama model is not available: ${model}`,
        );
        return;
    }

    logRegular(
        `preload ${isExternalOllamaEnabled() ? "external" : "internal"} ollama model ${model}`,
    );

    try {
        // Preload with the same num_ctx as the chat requests, otherwise Ollama
        // reloads the model on the first real request.
        await getOllamaApi().post(
            "/api/generate",
            withContextSize(
                {
                    model,
                    prompt: "",
                    stream: false,
                    keep_alive: -1,
                },
                getEffectiveOllamaContextSize(model),
            ),
            {
                timeout: isExternalOllamaEnabled()
                    ? OLLAMA_NON_CHAT_TIMEOUT
                    : 0,
            },
        );

        runtimeState.running = true;
        runtimeState.error = "";

        logSuccess(
            `${isExternalOllamaEnabled() ? "external" : "internal"} ollama model ${model} is loaded`,
        );
    } catch (error) {
        const normalizedError =
            normalizeAxiosError(error);

        runtimeState.error =
            normalizedError.message;

        if (isExternalOllamaEnabled()) {
            runtimeState.running = false;
        }

        logNotice(
            `ollama preload skipped for ${isExternalOllamaEnabled() ? "external" : "internal"} model ${model}: ${normalizedError.message}`,
        );

        emitOllamaUpdate();

        // Preloading is an optimization. A preload failure must not terminate
        // startup/sync; the next real request may still succeed.
        return;
    }

    emitOllamaUpdate();
}

async function refreshExternalOllamaState() {
    if (!isExternalOllamaEnabled()) return;

    try {
        const response = await getOllamaApi().get("/api/tags", {timeout: 5_000});
        const models = Array.isArray(response.data?.models) ? response.data.models : [];

        runtimeState.external_models = models
            .map((entry: any) => String(entry?.name ?? entry?.model ?? "").trim())
            .filter(Boolean);
        runtimeState.running = true;
        runtimeState.error = "";
    } catch (error) {
        const normalizedError = normalizeAxiosError(error);
        runtimeState.external_models = [];
        runtimeState.running = false;
        runtimeState.error = normalizedError.message;

        logWarn(`external ollama is not reachable: ${normalizedError.message}`);

        emitOllamaUpdate();
        return;
    }

    emitOllamaUpdate();
}

async function refreshExternalOpenAiState() {
    if (!isExternalOpenAiEnabled()) return;

    try {
        const response = await getOpenAiApi().get(
            getOpenAiPath("/v1/models"),
            {
                timeout: 5_000,
            },
        );

        const models = Array.isArray(response.data?.data)
            ? response.data.data
            : [];

        runtimeState.external_models = models
            .map((entry: any) =>
                String(entry?.id ?? entry?.name ?? "").trim(),
            )
            .filter(Boolean);

        runtimeState.running = true;
        runtimeState.error = "";
    } catch (error) {
        const normalizedError = normalizeAxiosError(error);

        runtimeState.external_models = [];
        runtimeState.running = false;
        runtimeState.error = normalizedError.message;

        logWarn(
            `OpenAI-compatible API is not reachable: ${normalizedError.message}`,
        );

        emitOllamaUpdate();
        return;
    }

    emitOllamaUpdate();
}

function normalizeAxiosError(
    error: unknown,
): Error {
    if (!axios.isAxiosError(error)) {
        return error instanceof Error
            ? error
            : new Error(
                String(error),
            );
    }

    const axiosError =
        error as AxiosError<any>;

    const responseData =
        axiosError.response?.data;

    const message =
        responseData?.error ??
        responseData?.message ??
        axiosError.message ??
        "ollama request failed";

    return new Error(
        String(message),
    );
}

export async function directOllamaRequest(
    data: any,
) {
    if (!isOllamaIntegrationEnabled()) {
        throw new Error(
            "ollama integration is disabled",
        );
    }

    await startOllama();

    if (isExternalOpenAiEnabled()) {
        throw new Error(
            "raw ollama requests are not available for OpenAI-compatible providers",
        );
    }

    const rawPath =
        String(
            data?.path ??
            data?.endpoint ??
            "",
        ).trim();

    if (!rawPath) {
        throw new Error(
            "path is required",
        );
    }

    const requestPath =
        rawPath.startsWith("/")
            ? rawPath
            : `/${rawPath}`;

    if (
        !requestPath.startsWith(
            "/api/",
        )
    ) {
        throw new Error(
            "only /api/* ollama paths are allowed",
        );
    }

    const method =
        String(
            data?.method ??
            "POST",
        ).toUpperCase() as Method;

    const allowedMethods =
        new Set([
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
        ]);

    if (!allowedMethods.has(method)) {
        throw new Error(
            `unsupported method: ${method}`,
        );
    }

    try {
        let requestData =
            data?.data ??
            data?.body;

        if (
            requestData &&
            typeof requestData === "object" &&
            (
                requestPath === "/api/chat" ||
                requestPath === "/api/generate"
            )
        ) {
            requestData = withContextSize(
                {
                    ...requestData,
                    think: false,
                    keep_alive: -1,
                },
                getEffectiveOllamaContextSize(
                    String(requestData.model ?? "").trim(),
                ),
            );
        }

        const requestedTimeout = Number(data?.timeout ?? 0);
        const isChatRequest = requestPath === "/api/chat";
        const timeout = Number.isFinite(requestedTimeout) && requestedTimeout > 0
            ? requestedTimeout
            : isChatRequest
                ? 0
                : OLLAMA_NON_CHAT_TIMEOUT;

        const response =
            await getOllamaApi().request({
                method,
                url: requestPath,
                params: data?.params,
                data: requestData,
                timeout,
            });

        return response.data;
    } catch (error) {
        throw normalizeAxiosError(
            error,
        );
    }
}

export type AiChatMessage = {
    role: "system" | "user" | "assistant" | "tool";
    content: string;
};

export async function aiChatRequest(
    messages: AiChatMessage[],
    timeout = 0,
    contextSize = 0,
) {
    if (!isOllamaIntegrationEnabled()) {
        throw new Error(
            "AI integration is disabled",
        );
    }

    const model = String(
        getOllamaIntegration().model ?? "",
    ).trim();

    if (!model) {
        throw new Error(
            "AI integration has no model configured",
        );
    }

    if (isExternalOpenAiEnabled()) {
        await refreshExternalOpenAiState();

        try {
            const response = await getOpenAiApi().post(
                getOpenAiPath("/v1/chat/completions"),
                {
                    model,
                    messages,
                    stream: false,
                },
                {
                    timeout:
                        Number.isFinite(timeout) &&
                        timeout > 0
                            ? timeout
                            : 0,
                },
            );

            return {
                content: String(
                    response.data?.choices?.[0]?.message?.content ?? "",
                ),
                raw: response.data,
            };
        } catch (error) {
            throw normalizeAxiosError(error);
        }
    }

    // A per-request context size overrides the configured one. Without it,
    // directOllamaRequest applies the configured/recommended context size.
    const response = await directOllamaRequest({
        path: "/api/chat",
        method: "POST",
        timeout,
        data: withContextSize(
            {
                model,
                messages,
                stream: false,
                keep_alive: -1,
            },
            normalizeContextSize(contextSize),
        ),
    });

    return {
        content: String(response?.message?.content ?? ""),
        raw: response,
    };
}

async function getInstalledModelNames() {
    const response =
        await getOllamaApi().get(
            "/api/tags",
        );

    const models =
        Array.isArray(
            response.data?.models,
        )
            ? response.data.models
            : [];

    return models
        .map(
            (entry: any) =>
                String(
                    entry?.name ??
                    entry?.model ??
                    "",
                ).trim(),
        )
        .filter(Boolean);
}

async function pullConfiguredOllamaModel() {
    if (isExternalAiEnabled()) return;

    const model =
        String(
            getOllamaIntegration()
                .model ??
            "",
        ).trim();

    if (!model) return;

    const installedModels =
        await getInstalledModelNames();

    if (
        installedModels.includes(
            model,
        )
    ) {
        logRegular(
            `ollama model ${model} is already installed`,
        );

        return;
    }

    runtimeState.changing_model = true;
    runtimeState.error = "";

    emitOllamaUpdate();

    try {
        logRegular(
            `download configured ollama model ${model}`,
        );

        await getOllamaApi().post(
            "/api/pull",
            {
                model,
                stream: false,
            },
            {
                timeout: 0,
            },
        );

        logSuccess(
            `ollama model ${model} is ready`,
        );
    } catch (error) {
        const normalizedError =
            normalizeAxiosError(
                error,
            );

        runtimeState.error =
            normalizedError.message;

        throw normalizedError;
    } finally {
        runtimeState.changing_model =
            false;

        emitOllamaUpdate();
    }
}

/**
 * Sets the user-defined context size. null/""/0 resets it to automatic
 * (recommendation from meta/ollama.json or the Ollama default).
 */
export async function changeOllamaContextSize(
    value: unknown,
) {
    const automatic =
        value === null ||
        value === undefined ||
        String(value).trim() === "" ||
        Number(value) === 0;

    const contextSize = automatic ? 0 : Number(value);

    if (
        !automatic &&
        (
            !Number.isInteger(contextSize) ||
            contextSize < OLLAMA_MIN_CONTEXT_SIZE ||
            contextSize > OLLAMA_MAX_CONTEXT_SIZE
        )
    ) {
        throw new Error(
            `context size must be an integer between ${OLLAMA_MIN_CONTEXT_SIZE} and ${OLLAMA_MAX_CONTEXT_SIZE}, or 0 for automatic`,
        );
    }

    const previous = getEffectiveOllamaContextSize();

    setOllamaIntegrationContextSize(contextSize);

    // Reload the model with the new num_ctx so the next request is fast.
    if (
        isOllamaIntegrationEnabled() &&
        runtimeState.running &&
        getEffectiveOllamaContextSize() !== previous
    ) {
        await preloadConfiguredOllamaModel();
    }

    emitOllamaUpdate();

    return getOllamaUpdate();
}

export async function changeOllamaModel(
    model: string,
) {
    const normalizedModel =
        String(
            model ??
            "",
        ).trim();

    if (!normalizedModel) {
        throw new Error(
            "model is required",
        );
    }

    if (
        !isOllamaIntegrationEnabled()
    ) {
        throw new Error(
            "ollama integration is disabled",
        );
    }

    if (isExternalAiEnabled()) {
        deleteLocalOllamaModels();

        if (isExternalOpenAiEnabled()) {
            await refreshExternalOpenAiState();

            if (
                runtimeState.external_models.length > 0 &&
                !runtimeState.external_models.includes(normalizedModel)
            ) {
                throw new Error(
                    `model is not available on OpenAI-compatible server: ${normalizedModel}`,
                );
            }

            setOllamaIntegrationModel(normalizedModel);

            runtimeState.running = true;
            runtimeState.error = "";
            emitOllamaUpdate();

            return getOllamaUpdate();
        }

        await refreshExternalOllamaState();

        if (
            runtimeState.external_models.length > 0 &&
            !runtimeState.external_models.includes(normalizedModel)
        ) {
            throw new Error(
                `ollama model is not available on external server: ${normalizedModel}`,
            );
        }

        const previousModel = String(
            getOllamaIntegration().model ?? "",
        ).trim();

        if (
            previousModel &&
            previousModel !== normalizedModel
        ) {
            await unloadConfiguredExternalOllamaModel();
        }

        setOllamaIntegrationModel(normalizedModel);

        await preloadConfiguredOllamaModel();

        runtimeState.running = true;
        runtimeState.error = "";
        emitOllamaUpdate();

        return getOllamaUpdate();
    }

    runtimeState.changing_model = true;
    runtimeState.error = "";

    emitOllamaUpdate();

    try {
        await startOllama();

        const installedModels =
            await getInstalledModelNames();

        for (
            const installedModel
            of installedModels
            ) {
            logRegular(
                `delete ollama model ${installedModel}`,
            );

            await getOllamaApi().delete(
                "/api/delete",
                {
                    data: {
                        model:
                        installedModel,
                    },
                },
            );
        }

        logRegular(
            `download ollama model ${normalizedModel}`,
        );

        await getOllamaApi().post(
            "/api/pull",
            {
                model:
                normalizedModel,
                stream: false,
            },
            {
                timeout: 0,
            },
        );

        setOllamaIntegrationModel(
            normalizedModel,
        );

        await restartOllama();

        return getOllamaUpdate();
    } catch (error) {
        const normalizedError =
            normalizeAxiosError(
                error,
            );

        runtimeState.error =
            normalizedError.message;

        throw normalizedError;
    } finally {
        runtimeState.changing_model =
            false;

        emitOllamaUpdate();
    }
}