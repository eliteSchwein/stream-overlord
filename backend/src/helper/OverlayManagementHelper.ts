import * as fs from "node:fs";
import * as path from "node:path";
import { getSystemConfigDirectory } from "./ConfigHelper";
import { logWarn } from "./LogHelper";
import getWebsocketServer from "../App";

export const overlayRoot = path.join(getSystemConfigDirectory(), "streambot-overlays");

export type OverlayListEntry = {
    name: string;
    path: string;
    type: "file" | "folder";
    size?: number;
    modified?: string;
};

function normalizeInputPath(input: string = ""): string {
    return String(input || "")
        .replace(/\\/g, "/")
        .replace(/^\/+/, "")
        .trim();
}

export function resolveOverlayPath(input: string = ""): string {
    const normalized = normalizeInputPath(input);
    const resolved = path.resolve(overlayRoot, normalized);

    if (resolved !== overlayRoot && !resolved.startsWith(`${overlayRoot}${path.sep}`)) {
        throw new Error("path must stay inside overlays directory");
    }

    return resolved;
}

function relativeOverlayPath(absPath: string): string {
    return path.relative(overlayRoot, absPath).replace(/\\/g, "/");
}

export function emitOverlayUpdate() {
    getWebsocketServer().send("notify_overlays_update", {
        files: listOverlays(""),
    });
}

export function listOverlays(inputPath: string = ""): OverlayListEntry[] {
    const directory = resolveOverlayPath(inputPath);

    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }

    const stat = fs.statSync(directory);

    if (!stat.isDirectory()) {
        throw new Error("overlay path must be a folder");
    }

    return fs.readdirSync(directory, { withFileTypes: true })
        .map((entry): OverlayListEntry => {
            const absPath = path.join(directory, entry.name);
            const entryStat = fs.statSync(absPath);
            const relPath = relativeOverlayPath(absPath);

            return {
                name: entry.name,
                path: relPath,
                type: entry.isDirectory() ? "folder" : "file",
                size: entry.isFile() ? entryStat.size : undefined,
                modified: entryStat.mtime.toISOString(),
            };
        })
        .sort((a, b) => {
            if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
}

export function createOverlayFolder(inputPath: string = "", name?: string) {
    const folderPath = name
        ? path.join(normalizeInputPath(inputPath), normalizeInputPath(name))
        : normalizeInputPath(inputPath);

    if (!folderPath) throw new Error("folder path missing");

    const target = resolveOverlayPath(folderPath);

    if (fs.existsSync(target)) {
        throw new Error("folder already exists");
    }

    fs.mkdirSync(target, { recursive: true });

    const relPath = relativeOverlayPath(target);

    emitOverlayUpdate();

    return { path: relPath };
}

export function deleteOverlay(inputPath: string) {
    if (!inputPath) throw new Error("path missing");

    const target = resolveOverlayPath(inputPath);

    if (!fs.existsSync(target)) {
        throw new Error("overlay not found");
    }

    const relPath = relativeOverlayPath(target);
    const stat = fs.statSync(target);

    if (stat.isDirectory()) {
        fs.rmSync(target, { recursive: true, force: true });
    } else {
        fs.unlinkSync(target);
    }

    emitOverlayUpdate();

    return { path: relPath };
}

export function moveOverlay(source: string, target: string) {
    if (!source) throw new Error("source missing");
    if (!target) throw new Error("target missing");

    const sourcePath = resolveOverlayPath(source);
    const targetPath = resolveOverlayPath(target);

    if (!fs.existsSync(sourcePath)) {
        throw new Error("source overlay not found");
    }

    if (fs.existsSync(targetPath)) {
        throw new Error("target already exists");
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.renameSync(sourcePath, targetPath);

    const sourceRel = relativeOverlayPath(sourcePath);
    const targetRel = relativeOverlayPath(targetPath);

    emitOverlayUpdate();

    return {
        source: sourceRel,
        target: targetRel,
    };
}

export async function addOverlayFilesFromUpload(files: any[], targetPath: string = "") {
    if (!files?.length) {
        throw new Error("no files uploaded");
    }

    const directory = resolveOverlayPath(targetPath);
    fs.mkdirSync(directory, { recursive: true });

    const added: string[] = [];

    for (const file of files) {
        const originalName = path.basename(file.originalname || "upload.bin");
        const target = path.join(directory, originalName);

        if (!target.startsWith(`${overlayRoot}${path.sep}`)) {
            logWarn(`invalid overlay upload target skipped: ${originalName}`);
            continue;
        }

        fs.writeFileSync(target, file.buffer);

        added.push(relativeOverlayPath(target));
    }

    emitOverlayUpdate();

    return added;
}

export type OverlayStorageInfo = {
    root: string;
    used: number;
    total: number;
    free: number;
    available: number;
    overlayUsed: number;
};

export function getOverlayStorageInfo(): OverlayStorageInfo {
    fs.mkdirSync(overlayRoot, { recursive: true });

    const statfs = fs.statfsSync(overlayRoot);
    const total = Number(statfs.blocks) * Number(statfs.bsize);
    const free = Number(statfs.bfree) * Number(statfs.bsize);
    const available = Number(statfs.bavail) * Number(statfs.bsize);
    const used = Math.max(total - free, 0);

    return {
        root: overlayRoot,
        used,
        total,
        free,
        available,
        overlayUsed: getDirectorySize(overlayRoot),
    };
}

function getDirectorySize(directory: string): number {
    if (!fs.existsSync(directory)) return 0;

    let size = 0;

    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name);

        try {
            if (entry.isDirectory()) {
                size += getDirectorySize(fullPath);
                continue;
            }

            if (entry.isFile()) {
                size += fs.statSync(fullPath).size;
            }
        } catch {
            logWarn(`failed to read overlay storage size for ${fullPath}`);
        }
    }

    return size;
}

export function editOverlayFile(inputPath: string, content: string) {
    if (!inputPath) throw new Error("path missing");
    if (typeof content !== "string") throw new Error("content missing");

    const target = resolveOverlayPath(inputPath);

    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
        throw new Error("overlay path must be a file");
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf8");

    const relPath = relativeOverlayPath(target);
    const stat = fs.statSync(target);

    emitOverlayUpdate();

    return {
        path: relPath,
        size: stat.size,
        modified: stat.mtime.toISOString(),
        created: true,
    };
}

export function readOverlayFile(inputPath: string) {
    if (!inputPath) throw new Error("path missing");

    const target = resolveOverlayPath(inputPath);

    if (!fs.existsSync(target)) {
        throw new Error("overlay file not found");
    }

    if (!fs.statSync(target).isFile()) {
        throw new Error("overlay path must be a file");
    }

    const relPath = relativeOverlayPath(target);
    const stat = fs.statSync(target);

    return {
        path: relPath,
        content: fs.readFileSync(target, "utf8"),
        size: stat.size,
        modified: stat.mtime.toISOString(),
    };
}