import axios, {AxiosError, Method} from "axios";
import {execFile} from "node:child_process";
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
import {runInstallScriptWithProgress, runStreaming, scalePercent} from "./UpdateProgress";

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

let installPromise: Promise<void> | null = null;
let processTransition: Promise<void> | null = null;

export type OllamaProgressStage =
    | "preparing"
    | "downloading"
    | "extracting"
    | "installing"
    | "removing"
    | "verifying"
    | "loading"
    | "dependencies"
    | "configuring"
    | "building";

export type OllamaProgress = {
    stage: OllamaProgressStage;
    // Overall progress 0-100, undefined = indeterminate.
    percent?: number;
    // Bytes (model download) or build steps (vulkan build) of the current step.
    completed?: number;
    total?: number;
    unit?: "bytes" | "steps";
    // Model being downloaded.
    model?: string;
    message?: string;
};

const runtimeState = {
    running: false,
    installing: false,
    changing_model: false,
    external_models: [] as string[],
    error: "",
    // Ollama runtime install or model change.
    progress: null as OllamaProgress | null,
    // Background build of the vulkan backend (arm64).
    vulkan_build: null as OllamaProgress | null,
};

const PROGRESS_EMIT_INTERVAL = 250;
let progressEmitTimer: NodeJS.Timeout | null = null;

// Progress callbacks fire very often (curl, pull stream), emit at most every
// PROGRESS_EMIT_INTERVAL ms.
function emitOllamaProgressThrottled() {
    if (progressEmitTimer) return;

    progressEmitTimer = setTimeout(() => {
        progressEmitTimer = null;
        emitOllamaUpdate();
    }, PROGRESS_EMIT_INTERVAL);
}

function setOllamaProgress(progress: OllamaProgress | null) {
    runtimeState.progress = progress;

    if (progress) {
        emitOllamaProgressThrottled();
    } else {
        emitOllamaUpdate();
    }
}

function setVulkanBuildProgress(progress: OllamaProgress | null) {
    runtimeState.vulkan_build = progress;

    if (progress) {
        emitOllamaProgressThrottled();
    } else {
        emitOllamaUpdate();
    }
}

export type OllamaUpdate = {
    enabled: boolean;
    installed: boolean;
    running: boolean;
    installing: boolean;
    changing_model: boolean;
    progress: OllamaProgress | null;
    vulkan_build: OllamaProgress | null;
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

function getScript(name: string) {
    const candidates = [
        path.resolve(__dirname, `../../scripts/${name}`),
        path.resolve(process.cwd(), `scripts/${name}`),
    ];

    const script = candidates.find((candidate) => fs.existsSync(candidate));
    if (!script) {
        throw new Error(`scripts/${name} not found`);
    }

    return script;
}

function getInstallScript() {
    return getScript("install_ollama.sh");
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

function getOllamaServiceEnvironment(): Record<string, string> {
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
        ].join(":"),
    };
}

// The internal Ollama runs as a systemd user service (like stream-overlord
// itself), so it can be managed via `systemctl --user` and used with the
// `ollama` CLI over SSH.
const OLLAMA_SERVICE_NAME = "streambot-ollama.service";

function getOllamaServicePath() {
    return path.join(os.homedir(), ".config", "systemd", "user", OLLAMA_SERVICE_NAME);
}

function getOllamaCliLinkPath() {
    return path.join(os.homedir(), ".local", "bin", "ollama");
}

function escapeSystemdValue(value: string) {
    return value
        .replace(/\\/g, "\\\\")
        .replace(/"/g, "\\\"")
        .replace(/%/g, "%%");
}

function buildOllamaServiceUnit() {
    const environment = Object.entries(getOllamaServiceEnvironment())
        .map(([key, value]) =>
            `Environment="${key}=${escapeSystemdValue(value)}"`,
        )
        .join("\n");

    return [
        "[Unit]",
        "Description=Ollama for Streambot",
        "After=network-online.target",
        "",
        "[Service]",
        "Type=simple",
        `ExecStart="${escapeSystemdValue(getOllamaBinary())}" serve`,
        environment,
        "Restart=on-failure",
        "RestartSec=3",
        "",
        "[Install]",
        "WantedBy=default.target",
        "",
    ].join("\n");
}

function runCommand(
    command: string,
    args: string[],
): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile(
            command,
            args,
            {timeout: 60_000},
            (error, stdout, stderr) => {
                if (error) {
                    const details = String(stderr || stdout || "").trim();
                    reject(new Error(
                        `${command} ${args.join(" ")} failed${details ? `: ${details}` : `: ${error.message}`}`,
                    ));
                    return;
                }

                resolve(String(stdout ?? "").trim());
            },
        );
    });
}

function systemctlUser(...args: string[]) {
    return runCommand("systemctl", ["--user", ...args]);
}

function isOllamaServiceInstalled() {
    return fs.existsSync(getOllamaServicePath());
}

function linkOllamaCli() {
    const linkPath = getOllamaCliLinkPath();
    const binary = getOllamaBinary();

    try {
        const stat = fs.lstatSync(linkPath, {throwIfNoEntry: false});

        if (stat) {
            if (!stat.isSymbolicLink()) {
                logNotice(`${linkPath} exists and is not managed by streambot, skip ollama cli link`);
                return;
            }

            if (fs.readlinkSync(linkPath) === binary) {
                return;
            }

            fs.unlinkSync(linkPath);
        }

        fs.mkdirSync(path.dirname(linkPath), {recursive: true});
        fs.symlinkSync(binary, linkPath);

        logSuccess(`ollama cli linked to ${linkPath}`);
    } catch (error: any) {
        logWarn(`failed to link ollama cli: ${error?.message ?? error}`);
    }
}

function unlinkOllamaCli() {
    const linkPath = getOllamaCliLinkPath();

    try {
        const stat = fs.lstatSync(linkPath, {throwIfNoEntry: false});

        if (
            stat?.isSymbolicLink() &&
            fs.readlinkSync(linkPath) === getOllamaBinary()
        ) {
            fs.unlinkSync(linkPath);
        }
    } catch (error: any) {
        logWarn(`failed to remove ollama cli link: ${error?.message ?? error}`);
    }
}

async function ensureLinger() {
    // Without lingering, user services stop when the last session ends and
    // only start once the user logs in.
    try {
        const linger = await runCommand(
            "loginctl",
            ["show-user", os.userInfo().username, "--property=Linger", "--value"],
        );

        if (linger === "yes") return;

        await runCommand("loginctl", ["enable-linger", os.userInfo().username]);
        logSuccess("enabled systemd lingering for the ollama user service");
    } catch (error: any) {
        logWarn(
            `could not enable lingering, ollama only runs while the user is logged in (run "sudo loginctl enable-linger ${os.userInfo().username}"): ${error?.message ?? error}`,
        );
    }
}

async function installOllamaService() {
    const servicePath = getOllamaServicePath();
    const unit = buildOllamaServiceUnit();
    const current = fs.existsSync(servicePath)
        ? fs.readFileSync(servicePath, "utf8")
        : null;
    const changed = current !== unit;

    if (changed) {
        fs.mkdirSync(path.dirname(servicePath), {recursive: true});
        fs.writeFileSync(servicePath, unit);
        await systemctlUser("daemon-reload");

        logSuccess(`ollama service written to ${servicePath}`);
    }

    linkOllamaCli();
    await ensureLinger();

    await systemctlUser("enable", OLLAMA_SERVICE_NAME);

    // Pick up a changed unit (e.g. new environment) on a running service.
    await systemctlUser(changed ? "restart" : "start", OLLAMA_SERVICE_NAME);
}

async function uninstallOllamaService() {
    unlinkOllamaCli();

    if (!isOllamaServiceInstalled()) return;

    try {
        await systemctlUser("disable", "--now", OLLAMA_SERVICE_NAME);
    } catch (error: any) {
        logWarn(`failed to stop ollama service: ${error?.message ?? error}`);
    }

    fs.rmSync(getOllamaServicePath(), {force: true});

    try {
        await systemctlUser("daemon-reload");
    } catch (error: any) {
        logWarn(`systemd daemon-reload failed: ${error?.message ?? error}`);
    }

    runtimeState.running = false;

    logSuccess("ollama service uninstalled");
}

// External provider: the internal Ollama is not needed, remove the service
// and the local models (the runtime is kept for a later switch back).
async function removeInternalOllama() {
    await uninstallOllamaService();
    deleteLocalOllamaModels();
}

let vulkanBuildPromise: Promise<void> | null = null;

function hasVulkanBackend() {
    return fs.existsSync(
        path.join(getOllamaRoot(), "lib", "ollama", "vulkan", "libggml-vulkan.so"),
    );
}

// Ollama only ships the Vulkan backend for amd64. On arm64 (Raspberry Pi) it
// is compiled from the matching Ollama source in the background, then the
// service is restarted to pick it up.
function buildVulkanBackendInBackground() {
    if (vulkanBuildPromise) return;

    let script: string;
    try {
        script = getScript("build_ollama_vulkan.sh");
    } catch (error: any) {
        logWarn(`cannot build ollama vulkan backend: ${error?.message ?? error}`);
        return;
    }

    logNotice("ollama has no vulkan backend for this architecture, building it in the background");

    setVulkanBuildProgress({stage: "preparing"});

    vulkanBuildPromise = runStreaming(
        "bash",
        [script],
        {
            env: {...process.env, OLLAMA_ROOT: getOllamaRoot()},
            onLine: (line, stream) => handleVulkanBuildLine(line, stream),
        },
    )
        .then(async () => {
            if (!hasVulkanBackend()) return;

            if (
                !isOllamaIntegrationEnabled() ||
                isExternalAiEnabled() ||
                !isOllamaServiceInstalled()
            ) {
                return;
            }

            logSuccess("ollama vulkan backend is ready, restarting ollama");

            await restartOllama();
        })
        .catch((error: any) => {
            logWarn(
                `ollama vulkan backend build failed, using CPU: ${error?.message ?? error}`,
            );
        })
        .finally(() => {
            vulkanBuildPromise = null;
            setVulkanBuildProgress(null);
        });
}

// Progress ranges of the vulkan build script phases.
const VULKAN_BUILD_PHASES: Array<{pattern: RegExp; stage: OllamaProgressStage; percent: number}> = [
    {pattern: /^(missing build dependencies|installing build dependencies)/i, stage: "dependencies", percent: 0},
    {pattern: /^downloading ollama .* source/i, stage: "downloading", percent: 2},
    {pattern: /^configuring vulkan backend/i, stage: "configuring", percent: 5},
    {pattern: /^building vulkan backend/i, stage: "building", percent: 10},
];

function handleVulkanBuildLine(line: string, stream: "stdout" | "stderr") {
    const current = runtimeState.vulkan_build;

    // ninja: "[123/456] Building CXX object ..."
    const step = line.match(/^\[(\d+)\/(\d+)\]\s*(.*)$/);
    if (step && current?.stage === "building") {
        const completed = Number(step[1]);
        const total = Number(step[2]);

        setVulkanBuildProgress({
            stage: "building",
            percent: scalePercent((completed / total) * 100, 10, 99),
            completed,
            total,
            unit: "steps",
            message: step[3],
        });
        return;
    }

    const phase = VULKAN_BUILD_PHASES.find((entry) => entry.pattern.test(line));
    if (phase) {
        setVulkanBuildProgress({stage: phase.stage, percent: phase.percent, message: line});
    }

    logChildOutput("ollama vulkan build", line, stream === "stderr");
}

function ensureVulkanBackend() {
    if (process.env.OLLAMA_VULKAN === "0") {
        return;
    }

    if (!hasVulkanBackend()) {
        if (os.arch() === "arm64") {
            buildVulkanBackendInBackground();
        } else {
            logWarn(
                "ollama build has no bundled vulkan backend, GPU acceleration via vulkan is unavailable",
            );
        }
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
        progress: runtimeState.progress,
        vulkan_build: runtimeState.vulkan_build,
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

            await runInstallScriptWithProgress(
                script,
                100,
                (progress) => setOllamaProgress({
                    stage: progress.stage as OllamaProgressStage,
                    percent: progress.percent,
                    message: progress.message,
                }),
                (line, stream) => logChildOutput(
                    "ollama install",
                    line,
                    stream === "stderr",
                ),
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
            setOllamaProgress(null);
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
    if (!isOllamaIntegrationEnabled()) {
        return;
    }

    if (isExternalAiEnabled()) {
        await removeInternalOllama();

        if (isExternalOpenAiEnabled()) {
            await refreshExternalOpenAiState();
            return;
        }

        await refreshExternalOllamaState();
        await preloadConfiguredOllamaModel();
        return;
    }

    await installOllama(false);

    ensureVulkanBackend();

    runtimeState.error = "";

    try {
        await installOllamaService();
        await waitForOllama();

        runtimeState.running = true;

        logSuccess(
            `ollama service ${OLLAMA_SERVICE_NAME} is running`,
        );

        emitOllamaUpdate();

        await preloadConfiguredOllamaModel();
    } catch (error: any) {
        runtimeState.running = false;
        runtimeState.error =
            error?.message ??
            "ollama server did not become ready";

        logWarn(
            `ollama startup failed: ${runtimeState.error} (see "journalctl --user -u ${OLLAMA_SERVICE_NAME}")`,
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

    if (isOllamaServiceInstalled()) {
        try {
            await systemctlUser("stop", OLLAMA_SERVICE_NAME);
        } catch (error: any) {
            logWarn(`failed to stop ollama service: ${error?.message ?? error}`);
        }
    }

    runtimeState.running = false;

    emitOllamaUpdate();
}

// Called when the app shuts down. The internal Ollama is a standalone service
// and stays running (usable via SSH), only an external model gets unloaded.
export async function shutdownOllama() {
    if (processTransition) {
        await processTransition.catch(
            () => undefined,
        );
    }

    if (isExternalOllamaEnabled()) {
        await unloadConfiguredExternalOllamaModel();
    }
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
    await uninstallOllamaService();

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
        await removeInternalOllama();

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
        await removeInternalOllama();

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

/**
 * Downloads a model via the streaming pull API and reports the download
 * progress mapped into from..to of the overall progress.
 */
async function pullOllamaModel(
    model: string,
    from = 0,
    to = 100,
) {
    setOllamaProgress({stage: "preparing", percent: from, model});

    const response = await getOllamaApi().post(
        "/api/pull",
        {
            model,
            stream: true,
        },
        {
            timeout: 0,
            responseType: "stream",
        },
    );

    // Ollama pulls the layers (blobs) of a model separately, each with its
    // own total/completed byte counts.
    const layers = new Map<string, {total: number; completed: number}>();
    let pullError = "";

    const handleLine = (line: string) => {
        if (!line.trim()) return;

        let entry: any;
        try {
            entry = JSON.parse(line);
        } catch {
            return;
        }

        if (entry?.error) {
            pullError = String(entry.error);
            return;
        }

        const status = String(entry?.status ?? "");
        const digest = String(entry?.digest ?? "");
        const layerTotal = Number(entry?.total);

        if (digest && Number.isFinite(layerTotal) && layerTotal > 0) {
            layers.set(digest, {
                total: layerTotal,
                completed: Math.min(Number(entry?.completed) || 0, layerTotal),
            });

            let total = 0;
            let completed = 0;
            for (const layer of layers.values()) {
                total += layer.total;
                completed += layer.completed;
            }

            setOllamaProgress({
                stage: "downloading",
                percent: scalePercent((completed / total) * 100, from, to),
                completed,
                total,
                unit: "bytes",
                model,
                message: status,
            });
            return;
        }

        if (/^pulling manifest/i.test(status)) {
            setOllamaProgress({stage: "preparing", percent: from, model, message: status});
            return;
        }

        if (/^(verifying|writing|removing|success)/i.test(status)) {
            setOllamaProgress({stage: "verifying", percent: to, model, message: status});
        }
    };

    await new Promise<void>((resolve, reject) => {
        const stream = response.data as NodeJS.ReadableStream;
        let buffer = "";

        stream.on("data", (chunk: Buffer) => {
            buffer += chunk.toString("utf8");

            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
                handleLine(line);
            }
        });

        stream.on("end", () => {
            handleLine(buffer);

            if (pullError) {
                reject(new Error(pullError));
                return;
            }

            resolve();
        });

        stream.on("error", reject);
    });
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

        await pullOllamaModel(model);

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

        setOllamaProgress(null);
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
        await removeInternalOllama();

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

    setOllamaProgress({stage: "preparing", model: normalizedModel});

    try {
        await startOllama();

        const installedModels =
            await getInstalledModelNames();

        for (
            const [index, installedModel]
            of installedModels.entries()
            ) {
            logRegular(
                `delete ollama model ${installedModel}`,
            );

            setOllamaProgress({
                stage: "removing",
                percent: scalePercent((index / installedModels.length) * 100, 0, 5),
                model: normalizedModel,
                message: installedModel,
            });

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

        await pullOllamaModel(normalizedModel, 5, 95);

        setOllamaIntegrationModel(
            normalizedModel,
        );

        // Restart + preload, duration unknown.
        setOllamaProgress({stage: "loading", model: normalizedModel});

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

        setOllamaProgress(null);
    }
}