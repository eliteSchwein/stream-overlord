import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {randomUUID} from "node:crypto";
import {getSystemConfigDirectory} from "./ConfigHelper";
import {logRegular, logWarn} from "./LogHelper";

const execFileAsync = promisify(execFile);
const RESTORE_PREFIX = "streambot-restore-";
const BACKUP_PREFIX = "streambot-backup-";
const BACKUP_MANIFEST = "streambot-backup.json";
const BACKUP_CONFIG_ROOT = "streambot";
const MAX_COMMAND_BUFFER = 128 * 1024 * 1024;

type RestoreNotifier = (method: string, data: any) => void;
let restoreNotifier: RestoreNotifier | undefined;

export type RestoreOption = {
    key: string;
    name: string;
    type: "file" | "directory";
    size_bytes: number;
    files: number;
    default_selected: boolean;
    children?: RestoreOption[];
};

type StagedRestore = {
    id: string;
    root: string;
    configRoot: string;
    archiveName: string;
    createdAt: string;
    options: RestoreOption[];
};

const stagedRestores = new Map<string, StagedRestore>();

export function setRestoreNotifier(notifier: RestoreNotifier) {
    restoreNotifier = notifier;
}

function notify(method: string, data: any) {
    restoreNotifier?.(method, data);
}

function timestampForFilename(date = new Date()) {
    return date.toISOString().replace(/[:.]/g, "-");
}

function isSafeArchiveEntry(entry: string) {
    if (!entry || entry.includes("\0")) return false;

    const normalized = entry.replace(/\\/g, "/");
    if (normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized)) return false;

    const parts = normalized.split("/").filter(Boolean);
    return !parts.some((part) => part === "..");
}

async function assertNoSymlinks(root: string) {
    let entries;

    try {
        entries = await fs.readdir(root, {withFileTypes: true});
    } catch (error: any) {
        if (error?.code === "ENOENT") return;
        throw error;
    }

    for (const entry of entries) {
        const fullPath = path.join(root, entry.name);
        const stat = await fs.lstat(fullPath);

        if (stat.isSymbolicLink()) {
            throw new Error(`symlinks are not supported in backup/restore: ${fullPath}`);
        }

        if (stat.isDirectory()) {
            await assertNoSymlinks(fullPath);
        }
    }
}

async function getEntryStats(target: string): Promise<{size_bytes: number; files: number}> {
    const stat = await fs.lstat(target);

    if (stat.isSymbolicLink()) {
        throw new Error(`symlinks are not supported in restore archives: ${target}`);
    }

    if (!stat.isDirectory()) {
        return {size_bytes: stat.size, files: 1};
    }

    let sizeBytes = 0;
    let files = 0;
    const entries = await fs.readdir(target, {withFileTypes: true});

    for (const entry of entries) {
        const child = await getEntryStats(path.join(target, entry.name));
        sizeBytes += child.size_bytes;
        files += child.files;
    }

    return {size_bytes: sizeBytes, files};
}

async function commandAvailable(command: string) {
    try {
        await execFileAsync("sh", ["-c", `command -v ${command}`], {maxBuffer: 1024 * 1024});
        return true;
    } catch {
        return false;
    }
}

async function requireZipTools() {
    if (!(await commandAvailable("zip"))) {
        throw new Error("zip is not installed; install the 'zip' package");
    }
    if (!(await commandAvailable("unzip"))) {
        throw new Error("unzip is not installed; install the 'unzip' package");
    }
}

export async function createBotBackup(): Promise<{path: string; filename: string}> {
    await requireZipTools();

    const configDir = getSystemConfigDirectory();
    await fs.mkdir(configDir, {recursive: true});
    await assertNoSymlinks(configDir);

    const createdAt = new Date();
    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), BACKUP_PREFIX));
    const archivePath = path.join(workDir, `streambot-backup-${timestampForFilename(createdAt)}.zip`);
    const manifestPath = path.join(workDir, BACKUP_MANIFEST);

    const manifest = {
        format: "streambot-backup",
        version: 1,
        created_at: createdAt.toISOString(),
        hostname: os.hostname(),
        config_root: BACKUP_CONFIG_ROOT,
    };

    await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const parent = path.dirname(configDir);
    const basename = path.basename(configDir);

    await execFileAsync("zip", ["-q", "-r", archivePath, basename], {
        cwd: parent,
        maxBuffer: MAX_COMMAND_BUFFER,
    });

    await execFileAsync("zip", ["-q", "-j", archivePath, manifestPath], {
        cwd: workDir,
        maxBuffer: MAX_COMMAND_BUFFER,
    });

    logRegular(`created streambot backup: ${archivePath}`);

    return {
        path: archivePath,
        filename: path.basename(archivePath),
    };
}

async function resolveRestoreConfigRoot(stageRoot: string) {
    const expected = path.join(stageRoot, BACKUP_CONFIG_ROOT);

    try {
        if ((await fs.stat(expected)).isDirectory()) {
            return expected;
        }
    } catch {
        // Fall back to the extracted archive root for older/manual backups.
    }

    return stageRoot;
}

async function buildRestoreOption(configRoot: string, relativePath: string): Promise<RestoreOption> {
    const fullPath = path.join(configRoot, relativePath);
    const stat = await fs.lstat(fullPath);

    if (stat.isSymbolicLink()) {
        throw new Error(`symlinks are not supported in restore archives: ${fullPath}`);
    }

    const name = path.basename(relativePath);

    if (!stat.isDirectory()) {
        return {
            key: relativePath.split(path.sep).join("/"),
            name,
            type: "file",
            size_bytes: stat.size,
            files: 1,
            default_selected: true,
        };
    }

    const entries = await fs.readdir(fullPath, {withFileTypes: true});
    const children: RestoreOption[] = [];

    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
        if (entry.name.startsWith(".")) continue;
        children.push(await buildRestoreOption(configRoot, path.join(relativePath, entry.name)));
    }

    return {
        key: relativePath.split(path.sep).join("/"),
        name,
        type: "directory",
        size_bytes: children.reduce((sum, child) => sum + child.size_bytes, 0),
        files: children.reduce((sum, child) => sum + child.files, 0),
        default_selected: true,
        children,
    };
}

async function buildRestoreOptions(configRoot: string): Promise<RestoreOption[]> {
    const entries = await fs.readdir(configRoot, {withFileTypes: true});
    const options: RestoreOption[] = [];

    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
        if (entry.name === BACKUP_MANIFEST) continue;
        if (entry.name.startsWith(".")) continue;
        options.push(await buildRestoreOption(configRoot, entry.name));
    }

    return options;
}

function flattenRestoreOptions(options: RestoreOption[]): RestoreOption[] {
    const flat: RestoreOption[] = [];

    const visit = (option: RestoreOption) => {
        flat.push(option);
        option.children?.forEach(visit);
    };

    options.forEach(visit);
    return flat;
}

export async function stageRestoreArchive(archivePath: string, archiveName = "backup.zip") {
    await requireZipTools();

    const restoreId = randomUUID();
    const stageRoot = path.join(os.tmpdir(), `${RESTORE_PREFIX}${restoreId}`);
    await fs.mkdir(stageRoot, {recursive: true});

    try {
        const {stdout: listOutput} = await execFileAsync("unzip", ["-Z1", archivePath], {
            maxBuffer: MAX_COMMAND_BUFFER,
        });

        const entries = listOutput.split(/\r?\n/).filter(Boolean);
        if (!entries.length) {
            throw new Error("restore archive is empty");
        }

        for (const entry of entries) {
            if (!isSafeArchiveEntry(entry)) {
                throw new Error(`unsafe path in restore archive: ${entry}`);
            }
        }

        await execFileAsync("unzip", ["-q", archivePath, "-d", stageRoot], {
            maxBuffer: MAX_COMMAND_BUFFER,
        });

        await assertNoSymlinks(stageRoot);

        const configRoot = await resolveRestoreConfigRoot(stageRoot);
        const options = await buildRestoreOptions(configRoot);

        if (!options.length) {
            throw new Error("restore archive does not contain any restorable files");
        }

        const restore: StagedRestore = {
            id: restoreId,
            root: stageRoot,
            configRoot,
            archiveName,
            createdAt: new Date().toISOString(),
            options,
        };

        stagedRestores.set(restoreId, restore);

        const flatOptions = flattenRestoreOptions(options);
        const payload = {
            restore_id: restoreId,
            filename: archiveName,
            created_at: restore.createdAt,
            options,
            total_files: flatOptions.filter((option) => option.type === "file").length,
            total_size_bytes: options.reduce((sum, option) => sum + option.size_bytes, 0),
        };

        notify("notify_restore_ready", payload);
        logRegular(`staged streambot restore ${restoreId} from ${archiveName}`);

        return payload;
    } catch (error) {
        await fs.rm(stageRoot, {recursive: true, force: true});
        throw error;
    } finally {
        await fs.rm(archivePath, {force: true}).catch(() => undefined);
    }
}

function validateRestoreSelection(restore: StagedRestore, selected: unknown): string[] {
    const allOptions = flattenRestoreOptions(restore.options);
    const optionByKey = new Map(allOptions.map((option) => [option.key, option]));
    const topLevel = restore.options.map((option) => option.key);

    const requested = Array.isArray(selected)
        ? selected.map((value) => String(value).replace(/\\/g, "/").replace(/^\/+|\/+$/g, ""))
        : topLevel;

    const unique = [...new Set(requested)].filter(Boolean);

    if (!unique.length) {
        throw new Error("at least one restore item must be selected");
    }

    for (const key of unique) {
        if (!optionByKey.has(key)) {
            throw new Error(`unknown restore item: ${key}`);
        }
    }

    // If a directory is selected, its descendants are implicitly selected.
    // Drop explicit descendants to avoid replacing/copying the same content twice.
    return unique.filter((key) => !unique.some((parent) => parent !== key && key.startsWith(`${parent}/`) && optionByKey.get(parent)?.type === "directory"));
}

export async function applyStagedRestore(restoreId: string, selected?: unknown) {
    const restore = stagedRestores.get(restoreId);
    if (!restore) {
        throw new Error("restore session not found or expired");
    }

    const selectedKeys = validateRestoreSelection(restore, selected);
    const configDir = getSystemConfigDirectory();
    await fs.mkdir(configDir, {recursive: true});

    const restored: string[] = [];

    for (const key of selectedKeys) {
        const source = path.join(restore.configRoot, key);
        const target = path.join(configDir, key);
        const sourceStat = await fs.lstat(source);

        await fs.mkdir(path.dirname(target), {recursive: true});
        await fs.rm(target, {recursive: true, force: true});
        await fs.cp(source, target, {
            recursive: sourceStat.isDirectory(),
            force: true,
            errorOnExist: false,
        });
        restored.push(key);
    }

    const payload = {
        restore_id: restoreId,
        restored,
        restart_required: true,
    };

    notify("notify_restore_complete", payload);
    await cleanupRestore(restoreId, false);

    logRegular(`applied streambot restore ${restoreId}: ${restored.join(", ")}`);
    return payload;
}

export async function cleanupRestore(restoreId: string, emitCancelled = true) {
    const restore = stagedRestores.get(restoreId);
    stagedRestores.delete(restoreId);

    if (!restore) return false;

    await fs.rm(restore.root, {recursive: true, force: true});
    if (emitCancelled) {
        notify("notify_restore_cancelled", {restore_id: restoreId});
    }
    return true;
}

export function getStagedRestore(restoreId: string) {
    const restore = stagedRestores.get(restoreId);
    if (!restore) return null;

    const flatOptions = flattenRestoreOptions(restore.options);
    return {
        restore_id: restore.id,
        filename: restore.archiveName,
        created_at: restore.createdAt,
        options: restore.options,
        total_files: flatOptions.filter((option) => option.type === "file").length,
        total_size_bytes: restore.options.reduce((sum, option) => sum + option.size_bytes, 0),
    };
}

async function readJournal(args: string[]) {
    const {stdout} = await execFileAsync("journalctl", args, {
        maxBuffer: MAX_COMMAND_BUFFER,
        env: process.env,
    });
    return stdout;
}

function hasJournalEntries(content: string) {
    return Boolean(content.trim()) && !content.includes("-- No entries --");
}

async function getBackendJournal() {
    const attempts: Array<{label: string; args: string[]}> = [];

    for (const unit of ["stream-overlord.service", "streambot-backend.service"]) {
        attempts.push({
            label: `user unit ${unit}`,
            args: ["--user", "-b", "-u", unit, "--no-pager", "-o", "short-iso"],
        });
        attempts.push({
            label: `system unit ${unit}`,
            args: ["-b", "-u", unit, "--no-pager", "-o", "short-iso"],
        });
    }

    for (const attempt of attempts) {
        try {
            const candidate = await readJournal(attempt.args);
            if (hasJournalEntries(candidate)) {
                return {
                    content: candidate,
                    source: attempt.label,
                };
            }
        } catch (error) {
            logWarn(`failed to read ${attempt.label} journal: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    return {
        content: "",
        source: "none",
    };
}

function logSection(title: string, content: string, detail?: string) {
    const header = [
        "================================================================================",
        title,
        ...(detail ? [detail] : []),
        "================================================================================",
        "",
    ].join("\n");

    return `${header}${content.trimEnd()}\n`;
}

export async function getCurrentSystemLog(scope = "combined") {
    const normalizedScope = String(scope || "combined").toLowerCase();
    let content = "";
    let label = normalizedScope;

    if (normalizedScope === "system") {
        content = await readJournal(["-b", "--no-pager", "-o", "short-iso"]);
    } else if (normalizedScope === "user") {
        content = await readJournal(["--user", "-b", "--no-pager", "-o", "short-iso"]);
    } else if (normalizedScope === "backend" || normalizedScope === "bot") {
        label = "backend";
        const backend = await getBackendJournal();
        content = backend.content;

        if (!hasJournalEntries(content)) {
            content = "No backend journal entries were found for stream-overlord.service or streambot-backend.service in the current boot.\n";
        }
    } else {
        label = "combined";

        let systemContent = "";
        try {
            systemContent = await readJournal(["-b", "--no-pager", "-o", "short-iso"]);
        } catch (error) {
            systemContent = `Failed to read system journal: ${error instanceof Error ? error.message : String(error)}\n`;
        }

        const backend = await getBackendJournal();
        const backendContent = hasJournalEntries(backend.content)
            ? backend.content
            : "No backend journal entries were found for stream-overlord.service or streambot-backend.service in the current boot.\n";

        content = [
            logSection("STREAMBOT / BACKEND LOG", backendContent, `Source: ${backend.source}`),
            "",
            logSection("SYSTEM LOG - CURRENT BOOT", systemContent),
        ].join("\n");
    }

    return {
        filename: `streambot-${label}-log-${timestampForFilename()}.log`,
        content,
    };
}
