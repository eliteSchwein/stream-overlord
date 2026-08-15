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
    setOllamaIntegrationModel,
} from "./IntegrationsHelper";
import {logRegular, logSuccess, logWarn} from "./LogHelper";

const OLLAMA_API_URL = "http://127.0.0.1:11434";
const OLLAMA_HOST = "127.0.0.1:11434";

function isExternalOllamaEnabled() {
    return Boolean(getOllamaIntegration().external);
}

function getOllamaApi() {
    const integration = getOllamaIntegration();
    const external = Boolean(integration.external);
    const baseURL = external
        ? String(integration.external_url ?? "").trim().replace(/\/+$/, "")
        : OLLAMA_API_URL;

    if (external && !baseURL) {
        throw new Error("external ollama URL is not configured");
    }

    const apiKey = String(integration.api_key ?? "").trim();

    return axios.create({
        baseURL,
        timeout: 30_000,
        headers: apiKey
            ? {Authorization: `Bearer ${apiKey}`}
            : undefined,
    });
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
    ram_mib: number;
    external: boolean;
    external_url: string;
    has_api_key: boolean;
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
        LD_LIBRARY_PATH: [
            path.join(root, "lib", "ollama"),
            path.join(root, "lib"),
            process.env.LD_LIBRARY_PATH,
        ].filter(Boolean).join(":"),
    };
}

export function isOllamaInstalled() {
    return fs.existsSync(getOllamaBinary());
}

function readTestedModels(): Record<string, string[]> {
    try {
        const parsed = JSON.parse(
            fs.readFileSync(getModelConfigPath(), "utf8"),
        );

        if (
            !parsed ||
            typeof parsed !== "object" ||
            Array.isArray(parsed)
        ) {
            return {};
        }

        return parsed;
    } catch (error: any) {
        runtimeState.error =
            error?.message ?? "failed to read ollama.json";

        return {};
    }
}

export function getAvailableOllamaModels() {
    if (isExternalOllamaEnabled()) {
        return [...runtimeState.external_models];
    }

    const ramMiB = Math.floor(os.totalmem() / 1024 / 1024);
    const testedModels = readTestedModels();
    const models = new Set<string>();

    Object.entries(testedModels)
        .map(([ram, entries]) => ({
            ram: Number(ram),
            entries,
        }))
        .filter(
            ({ram, entries}) =>
                Number.isFinite(ram) &&
                ram <= ramMiB &&
                Array.isArray(entries),
        )
        .sort((a, b) => a.ram - b.ram)
        .forEach(({entries}) => {
            for (const model of entries) {
                const normalized = String(model ?? "").trim();

                if (normalized) {
                    models.add(normalized);
                }
            }
        });

    return [...models];
}

export function getOllamaUpdate(): OllamaUpdate {
    const integration = getOllamaIntegration();

    return {
        enabled: Boolean(integration.enabled),
        installed: Boolean(integration.external) || isOllamaInstalled(),
        running: runtimeState.running,
        installing: runtimeState.installing,
        changing_model: runtimeState.changing_model,
        model: String(integration.model ?? ""),
        models: getAvailableOllamaModels(),
        ram_mib: Math.floor(os.totalmem() / 1024 / 1024),
        external: Boolean(integration.external),
        external_url: String(integration.external_url ?? ""),
        has_api_key: Boolean(integration.api_key),
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
            logWarn(`${prefix}: ${line}`);
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

    if (isExternalOllamaEnabled()) {
        await refreshExternalOllamaState();
        return;
    }

    await installOllama(false);

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
                true,
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

    await waitForOllama();
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

async function stopOllamaInternal() {
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

    if (isExternalOllamaEnabled()) {
        await refreshExternalOllamaState();
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

    if (isExternalOllamaEnabled()) {
        await stopOllama();
        await refreshExternalOllamaState();
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

    // A disabled integration purges the complete
    // Ollama directory while the configured model
    // remains in integrations.json.
    //
    // After a fresh install automatically restore
    // that configured model.
    if (!wasInstalled) {
        await pullConfiguredOllamaModel();
    }

    return getOllamaUpdate();
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
        emitOllamaUpdate();
        throw normalizedError;
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
            requestData = {
                ...requestData,
                think: false,
            };
        }

        const response =
            await getOllamaApi().request({
                method,
                url: requestPath,
                params: data?.params,
                data: requestData,
                timeout:
                    Number(
                        data?.timeout ??
                        0,
                    ) || 0,
            });

        return response.data;
    } catch (error) {
        throw normalizeAxiosError(
            error,
        );
    }
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
    if (isExternalOllamaEnabled()) return;

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

    if (isExternalOllamaEnabled()) {
        await refreshExternalOllamaState();

        if (
            runtimeState.external_models.length > 0 &&
            !runtimeState.external_models.includes(normalizedModel)
        ) {
            throw new Error(`ollama model is not available on external server: ${normalizedModel}`);
        }

        setOllamaIntegrationModel(normalizedModel);
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