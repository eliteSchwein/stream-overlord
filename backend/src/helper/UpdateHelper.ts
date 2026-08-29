import {execFile} from "node:child_process";
import {promisify} from "node:util";
import * as os from "node:os";
import * as path from "node:path";
import {existsSync, mkdirSync, readFileSync, readdirSync} from "node:fs";
import {getConfig} from "./ConfigHelper";
import {logError, logNotice, logRegular, logWarn} from "./LogHelper";

const execFileAsync = promisify(execFile);

export type UpdateManagerConfig = {
    git?: string;
    path?: string;
    package?: string;
    service?: string;
    user_service?: boolean;
    reload?: string;
    npm_install?: boolean;
    ollama?: boolean;
    piper?: boolean;
};

export type AptUpdatePackage = {
    package: string;
    current_version?: string;
    latest_version?: string;
};

export type UpdateManagerState = {
    name: string;
    type: "git" | "apt" | "ollama" | "piper";
    current_version?: string;
    latest_version?: string;
    commit?: string;
    latest_commit?: string;
    updates?: AptUpdatePackage[];
    update_available: boolean;
    checking: boolean;
    updating: boolean;
    error?: string;
};

export type UpdateManagerPayload = Record<string, UpdateManagerState>;

// Default update-manager configuration. Values from [update_manager <name>]
// in .env.conf are merged on top of these entries.
export const defaultUpdateManagers: Record<string, UpdateManagerConfig> = {
    backend: {
        git: "https://github.com/eliteSchwein/stream-overlord.git",
        path: "$HOME/stream-overlord",
        service: "stream-overlord",
        user_service: true,
        npm_install: true,
    },
    touch: {
        package: "streambot-touch",
        service: "streambottouch",
    },
    overlay: {
        git: "https://github.com/eliteSchwein/streambot-local-overlay-frontend.git",
        path: "$HOME/.local/share/streambot/stream-overlord-overlay",
        reload: "overlay",
    },
    admin: {
        git: "https://github.com/eliteSchwein/streambot-local-admin-frontend.git",
        path: "$HOME/.local/share/streambot/stream-overlord-admin",
        reload: "admin",
    },
    ollama: {
        ollama: true,
    },
    piper: {
        piper: true,
    },
};

const CHECK_INTERVAL = 24 * 60 * 60 * 1000;

let updateState: UpdateManagerPayload = {};
let checkTimer: NodeJS.Timeout | undefined;
let initialized = false;
let notifier: ((method: "notify_service_reload" | "notify_update_manager", data: any) => void) | undefined;

function booleanValue(value: unknown, fallback = false): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;

    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (["true", "1", "yes", "on"].includes(normalized)) return true;
        if (["false", "0", "no", "off"].includes(normalized)) return false;
    }

    return fallback;
}

function normalizePath(value: string): string {
    const expanded = value
        .replace(/^\$HOME(?=\/|$)/, os.homedir())
        .replace(/^~(?=\/|$)/, os.homedir());

    return path.resolve(expanded);
}

function normalizeConfig(raw: UpdateManagerConfig): UpdateManagerConfig {
    return {
        ...(raw.git ? {git: String(raw.git).trim()} : {}),
        ...(raw.path ? {path: normalizePath(String(raw.path).trim())} : {}),
        ...(raw.package ? {package: String(raw.package).trim()} : {}),
        ...(raw.service ? {service: String(raw.service).trim()} : {}),
        ...(raw.reload ? {reload: String(raw.reload).trim()} : {}),
        user_service: booleanValue(raw.user_service),
        npm_install: booleanValue(raw.npm_install),
        ollama: booleanValue(raw.ollama),
        piper: booleanValue(raw.piper),
    };
}

export function getUpdateManagerConfig(): Record<string, UpdateManagerConfig> {
    const configured = (getConfig(/^update_manager /, true) ?? {}) as Record<string, UpdateManagerConfig>;
    const result: Record<string, UpdateManagerConfig> = {};

    for (const [name, defaults] of Object.entries(defaultUpdateManagers)) {
        result[name] = normalizeConfig({
            ...defaults,
            ...(configured[name] ?? {}),
        });
    }

    for (const [name, custom] of Object.entries(configured)) {
        if (result[name]) continue;
        result[name] = normalizeConfig(custom);
    }

    return result;
}

export function setUpdateManagerNotifier(
    callback: (method: "notify_service_reload" | "notify_update_manager", data: any) => void,
) {
    notifier = callback;
}

function emitUpdateManager() {
    notifier?.("notify_update_manager", getUpdateManagerStatus());
}

function errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
}

async function run(command: string, args: string[], cwd?: string): Promise<string> {
    const {stdout} = await execFileAsync(command, args, {
        cwd,
        encoding: "utf8",
        maxBuffer: 8 * 1024 * 1024,
    });

    return stdout.trim();
}

async function gitValue(repoPath: string, args: string[]): Promise<string | undefined> {
    try {
        const value = await run("git", ["-C", repoPath, ...args]);
        return value || undefined;
    } catch {
        return undefined;
    }
}


async function ensureGitRepository(name: string, config: UpdateManagerConfig): Promise<void> {
    if (!config.path) {
        throw new Error(`update manager '${name}' has git configured but no path`);
    }

    if (!config.git) {
        throw new Error(`update manager '${name}' has no git URL configured`);
    }

    if (!existsSync(config.path)) {
        mkdirSync(path.dirname(config.path), {recursive: true});
        logNotice(`update manager '${name}' target missing, cloning ${config.git} to ${config.path}`);
        await run("git", ["clone", config.git, config.path]);
        return;
    }

    const entries = readdirSync(config.path);

    if (entries.length === 0) {
        logNotice(`update manager '${name}' target is empty, cloning ${config.git} to ${config.path}`);
        await run("git", ["clone", config.git, "."] , config.path);
        return;
    }

    const gitDir = path.join(config.path, ".git");

    if (!existsSync(gitDir)) {
        throw new Error(
            `update manager '${name}' target '${config.path}' exists but is not a git repository`,
        );
    }
}

async function checkGit(name: string, config: UpdateManagerConfig): Promise<UpdateManagerState> {
    if (!config.path) {
        throw new Error(`update manager '${name}' has git configured but no path`);
    }

    await ensureGitRepository(name, config);

    // The configured git URL is also used to repair/add origin when necessary.
    const currentOrigin = await gitValue(config.path, ["remote", "get-url", "origin"]);

    if (!currentOrigin && config.git) {
        await run("git", ["-C", config.path, "remote", "add", "origin", config.git]);
    } else if (config.git && currentOrigin !== config.git) {
        await run("git", ["-C", config.path, "remote", "set-url", "origin", config.git]);
    }

    await run("git", ["-C", config.path, "fetch", "--quiet", "--prune"]);

    const head = await gitValue(config.path, ["rev-parse", "HEAD"]);
    const upstream = await gitValue(config.path, ["rev-parse", "@{u}"]);
    const version = await gitValue(config.path, ["describe", "--tags", "--always", "--dirty"]);
    const latestVersion = upstream
        ? await gitValue(config.path, ["describe", "--tags", "--always", upstream])
        : undefined;

    if (!head) {
        throw new Error(`could not read current git commit for '${name}'`);
    }

    if (!upstream) {
        throw new Error(`git repository '${name}' has no upstream branch`);
    }

    return {
        name,
        type: "git",
        current_version: version,
        latest_version: latestVersion,
        commit: head.slice(0, 8),
        latest_commit: upstream.slice(0, 8),
        update_available: head !== upstream,
        checking: false,
        updating: false,
    };
}

function parseAptPolicy(policy: string): {installed?: string; candidate?: string} {
    const installed = policy.match(/^\s*Installed:\s*(.+)$/m)?.[1]?.trim();
    const candidate = policy.match(/^\s*Candidate:\s*(.+)$/m)?.[1]?.trim();

    return {
        installed: installed && installed !== "(none)" ? installed : undefined,
        candidate: candidate && candidate !== "(none)" ? candidate : undefined,
    };
}

async function refreshAptCache() {
    try {
        await run("sudo", ["-n", "apt-get", "update", "-qq"]);
    } catch (error) {
        // Checking the existing apt cache is still useful if passwordless sudo is not available.
        logWarn(`apt cache refresh failed: ${errorMessage(error)}`);
    }
}

async function checkApt(name: string, config: UpdateManagerConfig): Promise<UpdateManagerState> {
    if (!config.package) {
        throw new Error(`update manager '${name}' has no package configured`);
    }

    const policy = await run("apt-cache", ["policy", config.package]);
    const {installed, candidate} = parseAptPolicy(policy);

    return {
        name,
        type: "apt",
        current_version: installed,
        latest_version: candidate,
        update_available: Boolean(installed && candidate && installed !== candidate),
        checking: false,
        updating: false,
    };
}

function getOllamaBinaryPath(): string {
    return path.join(os.homedir(), ".local", "share", "streambot", "ollama", "bin", "ollama");
}

function parseOllamaVersion(value: string): string | undefined {
    const match = value.match(/(?:ollama\s+version(?:\s+is)?\s+|version\s+)?v?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/i);
    return match?.[1];
}

async function getInstalledOllamaVersion(): Promise<string | undefined> {
    const binary = getOllamaBinaryPath();

    if (!existsSync(binary)) {
        return undefined;
    }

    try {
        return parseOllamaVersion(await run(binary, ["--version"]));
    } catch {
        return undefined;
    }
}

async function getLatestOllamaVersion(): Promise<string | undefined> {
    const latestUrl = await run("curl", [
        "-fsSL",
        "-o", "/dev/null",
        "-w", "%{url_effective}",
        "https://github.com/ollama/ollama/releases/latest",
    ]);

    const tag = latestUrl.match(/\/tag\/v?([^/?#]+)$/)?.[1];
    return tag || undefined;
}

async function checkOllama(name: string): Promise<UpdateManagerState> {
    const [currentVersion, latestVersion] = await Promise.all([
        getInstalledOllamaVersion(),
        getLatestOllamaVersion(),
    ]);

    return {
        name,
        type: "ollama",
        current_version: currentVersion,
        latest_version: latestVersion,
        update_available: Boolean(
            currentVersion
            && latestVersion
            && currentVersion !== latestVersion
        ),
        checking: false,
        updating: false,
    };
}

function getOllamaInstallScript(): string {
    const candidates = [
        path.resolve(process.cwd(), "scripts", "install_ollama.sh"),
        path.resolve(__dirname, "../../scripts/install_ollama.sh"),
        path.resolve(__dirname, "../../../scripts/install_ollama.sh"),
    ];

    const script = candidates.find((candidate) => existsSync(candidate));

    if (!script) {
        throw new Error("could not find scripts/install_ollama.sh");
    }

    return script;
}

async function updateOllama(): Promise<void> {
    const script = getOllamaInstallScript();

    logNotice(`updating ollama using ${script}`);
    await run("bash", [script]);

    try {
        const {restartOllama} = await import("./OllamaHelper");
        await restartOllama();
    } catch (error) {
        logWarn(`ollama updated but restart failed: ${errorMessage(error)}`);
    }
}

function getPiperRoot(): string {
    return path.join(os.homedir(), ".local", "share", "streambot", "tts");
}

function getInstalledPiperVersion(): string | undefined {
    const binary = path.join(getPiperRoot(), "piper");
    const versionFile = path.join(getPiperRoot(), ".version");

    if (!existsSync(binary) || !existsSync(versionFile)) {
        return undefined;
    }

    try {
        return readFileSync(versionFile, "utf8").trim() || undefined;
    } catch {
        return undefined;
    }
}

async function getLatestPiperVersion(): Promise<string | undefined> {
    const latestUrl = await run("curl", [
        "-fsSL",
        "-o", "/dev/null",
        "-w", "%{url_effective}",
        "https://github.com/rhasspy/piper/releases/latest",
    ]);

    const tag = latestUrl.match(/\/tag\/v?([^/?#]+)$/)?.[1];
    return tag || undefined;
}

async function checkPiper(name: string): Promise<UpdateManagerState> {
    const [currentVersion, latestVersion] = await Promise.all([
        Promise.resolve(getInstalledPiperVersion()),
        getLatestPiperVersion(),
    ]);

    return {
        name,
        type: "piper",
        current_version: currentVersion,
        latest_version: latestVersion,
        update_available: Boolean(
            currentVersion
            && latestVersion
            && currentVersion !== latestVersion
        ),
        checking: false,
        updating: false,
    };
}

function getPiperInstallScript(): string {
    const candidates = [
        path.resolve(process.cwd(), "scripts", "install_tts.sh"),
        path.resolve(__dirname, "../../scripts/install_tts.sh"),
        path.resolve(__dirname, "../../../scripts/install_tts.sh"),
    ];

    const script = candidates.find((candidate) => existsSync(candidate));

    if (!script) {
        throw new Error("could not find scripts/install_tts.sh");
    }

    return script;
}

async function updatePiper(): Promise<void> {
    const script = getPiperInstallScript();

    logNotice(`updating piper using ${script}`);
    await run("bash", [script]);

    try {
        const {emitSystemStorageUpdate} = await import("./SystemStorageHelper");
        emitSystemStorageUpdate();
    } catch (error) {
        logWarn(`piper updated but storage refresh failed: ${errorMessage(error)}`);
    }
}

function getManagerType(config: UpdateManagerConfig): UpdateManagerState["type"] {
    if (config.ollama) return "ollama";
    if (config.piper) return "piper";
    if (config.package) return "apt";
    return "git";
}

function parseAptUpgradable(output: string): AptUpdatePackage[] {
    const updates: AptUpdatePackage[] = [];

    for (const line of output.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("Listing...")) continue;

        // package/source version architecture [upgradable from: version]
        const match = trimmed.match(/^([^/]+)\/\S+\s+(\S+)\s+\S+\s+\[upgradable from:\s*([^\]]+)\]$/);
        if (!match) continue;

        updates.push({
            package: match[1],
            current_version: match[3],
            latest_version: match[2],
        });
    }

    return updates;
}

async function checkSystemApt(excludedPackages: Set<string>): Promise<UpdateManagerState> {
    const output = await run("apt", ["list", "--upgradable"]);
    const updates = parseAptUpgradable(output)
        .filter((entry) => !excludedPackages.has(entry.package))
        .sort((a, b) => a.package.localeCompare(b.package));

    return {
        name: "system",
        type: "apt",
        updates,
        update_available: updates.length > 0,
        checking: false,
        updating: false,
    };
}

export async function checkUpdates(): Promise<UpdateManagerPayload> {
    const managers = getUpdateManagerConfig();
    const managedPackages = new Set(
        Object.values(managers)
            .map((manager) => manager.package)
            .filter((packageName): packageName is string => Boolean(packageName)),
    );
    const hasAptManager = managedPackages.size > 0;

    for (const [name, config] of Object.entries(managers)) {
        const previous = updateState[name];
        updateState[name] = {
            name,
            type: getManagerType(config),
            current_version: previous?.current_version,
            latest_version: previous?.latest_version,
            commit: previous?.commit,
            latest_commit: previous?.latest_commit,
            updates: previous?.updates,
            update_available: previous?.update_available ?? false,
            checking: true,
            updating: previous?.updating ?? false,
        };
    }

    const previousSystem = updateState.system;
    updateState.system = {
        name: "system",
        type: "apt",
        updates: previousSystem?.updates ?? [],
        update_available: previousSystem?.update_available ?? false,
        checking: true,
        updating: previousSystem?.updating ?? false,
    };

    emitUpdateManager();

    // System updates are always apt based, therefore refresh the cache even when no
    // explicitly configured apt package managers exist.
    await refreshAptCache();

    await Promise.all([
        ...Object.entries(managers).map(async ([name, config]) => {
            try {
                const result = config.ollama
                    ? await checkOllama(name)
                    : config.piper
                        ? await checkPiper(name)
                        : config.package
                            ? await checkApt(name, config)
                            : await checkGit(name, config);

                updateState[name] = {
                    ...result,
                    updating: updateState[name]?.updating ?? false,
                };
            } catch (error) {
                updateState[name] = {
                    ...updateState[name],
                    name,
                    type: getManagerType(config),
                    update_available: false,
                    checking: false,
                    updating: false,
                    error: errorMessage(error),
                };

                logWarn(`update check failed for ${name}: ${errorMessage(error)}`);
            }
        }),
        (async () => {
            try {
                updateState.system = {
                    ...(await checkSystemApt(managedPackages)),
                    updating: updateState.system?.updating ?? false,
                };
            } catch (error) {
                updateState.system = {
                    ...updateState.system,
                    name: "system",
                    type: "apt",
                    update_available: false,
                    checking: false,
                    updating: false,
                    error: errorMessage(error),
                };

                logWarn(`system update check failed: ${errorMessage(error)}`);
            }
        })(),
    ]);

    emitUpdateManager();
    return getUpdateManagerStatus();
}

async function runPostUpdateAction(config: UpdateManagerConfig) {
    if (config.npm_install) {
        if (!config.path) {
            throw new Error("npm_install requires a configured path");
        }

        logNotice(`running production npm install in ${config.path}`);
        await run("npm", ["ci", "--omit=dev"], config.path);
    }

    if (config.reload) {
        notifier?.("notify_service_reload", {type: config.reload});
    }

    if (!config.service) return;

    if (config.user_service) {
        await run("systemctl", ["restart", "--user", config.service]);
        return;
    }

    await run("sudo", ["-n", "systemctl", "restart", config.service]);
}

export async function updateManager(name: string): Promise<UpdateManagerState> {
    const managers = getUpdateManagerConfig();
    const isSystem = name === "system";
    const config = managers[name];

    if (!isSystem && !config) {
        throw new Error(`unknown update manager '${name}'`);
    }

    const current = updateState[name];
    updateState[name] = {
        name,
        type: isSystem ? "apt" : getManagerType(config!),
        current_version: current?.current_version,
        latest_version: current?.latest_version,
        commit: current?.commit,
        latest_commit: current?.latest_commit,
        updates: current?.updates,
        update_available: current?.update_available ?? false,
        checking: false,
        updating: true,
    };
    emitUpdateManager();

    try {
        if (isSystem) {
            const packages = (current?.updates ?? []).map((entry) => entry.package);

            if (packages.length > 0) {
                await run("sudo", ["-n", "apt-get", "install", "-y", "--only-upgrade", ...packages]);
            }

            const managedPackages = new Set(
                Object.values(managers)
                    .map((manager) => manager.package)
                    .filter((packageName): packageName is string => Boolean(packageName)),
            );

            updateState.system = await checkSystemApt(managedPackages);
            emitUpdateManager();
            logNotice("system update completed");
            return updateState.system;
        }

        if (config!.ollama) {
            await updateOllama();
        } else if (config!.piper) {
            await updatePiper();
        } else if (config!.package) {
            await run("sudo", ["-n", "apt-get", "install", "-y", "--only-upgrade", config!.package]);
        } else {
            if (!config!.path) {
                throw new Error(`update manager '${name}' has git configured but no path`);
            }

            await ensureGitRepository(name, config!);
            await run("git", ["-C", config!.path, "pull", "--ff-only"]);
        }

        const checked = config!.ollama
            ? await checkOllama(name)
            : config!.piper
                ? await checkPiper(name)
                : config!.package
                    ? await checkApt(name, config!)
                    : await checkGit(name, config!);

        updateState[name] = checked;
        emitUpdateManager();

        logNotice(`update completed for ${name}`);
        await runPostUpdateAction(config!);

        return updateState[name];
    } catch (error) {
        const message = errorMessage(error);

        updateState[name] = {
            ...updateState[name],
            checking: false,
            updating: false,
            error: message,
        };
        emitUpdateManager();

        logError(`update failed for ${name}: ${message}`);
        throw error;
    }
}

export function getUpdateManagerStatus(): UpdateManagerPayload {
    return JSON.parse(JSON.stringify(updateState));
}

export function initializeUpdateManager() {
    if (initialized) return;
    initialized = true;

    logRegular("initial update manager");
    void checkUpdates();

    checkTimer = setInterval(() => {
        void checkUpdates();
    }, CHECK_INTERVAL);

    checkTimer.unref?.();
}
