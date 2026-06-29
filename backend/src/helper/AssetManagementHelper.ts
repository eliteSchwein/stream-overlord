import * as fs from "node:fs";
import * as path from "node:path";
import {compressAssets, getAssetFile} from "./AssetTuneHelper";
import {audioRegex, getParsedAssetFiles, imageRegex, readAssetFolder, videoRegex} from "./AssetHelper";
import {logRegular, logWarn} from "./LogHelper";
import getWebsocketServer from "../App";
import {getSystemConfigDirectory} from "./ConfigHelper";
import {emitSystemStorageUpdate} from "./SystemStorageHelper";

export const assetRoot = path.join(getSystemConfigDirectory(), "assets");
export const compressedAssetRoot = path.join(getSystemConfigDirectory(), "compressed_assets");

export type AssetListEntry = {
    name: string;
    path: string;
    type: "file" | "folder";
    size?: number;
    modified?: string;
    asset?: any;
};

function normalizeInputPath(input: string = ""): string {
    return String(input || "")
        .replace(/\\/g, "/")
        .replace(/^\/+/, "")
        .trim();
}

export function resolveAssetPath(input: string = ""): string {
    const normalized = normalizeInputPath(input);
    const resolved = path.resolve(assetRoot, normalized);

    if (resolved !== assetRoot && !resolved.startsWith(`${assetRoot}${path.sep}`)) {
        throw new Error("path must stay inside assets directory");
    }

    return resolved;
}

function relativeAssetPath(absPath: string): string {
    return path.relative(assetRoot, absPath).replace(/\\/g, "/");
}

function compressedRelativePath(relativePath: string): string | null {
    if (videoRegex.test(relativePath)) return relativePath.replace(videoRegex, ".webm");
    if (imageRegex.test(relativePath)) return relativePath.replace(imageRegex, ".webp");
    if (audioRegex.test(relativePath)) return relativePath.replace(audioRegex, ".opus");
    return null;
}

function deleteCompressedForAsset(relativePath: string) {
    const compressedRelative = compressedRelativePath(relativePath);
    if (!compressedRelative) return;

    const compressedPath = path.resolve(compressedAssetRoot, compressedRelative);

    if (compressedPath !== compressedAssetRoot && !compressedPath.startsWith(`${compressedAssetRoot}${path.sep}`)) {
        return;
    }

    if (fs.existsSync(compressedPath)) {
        logRegular(`delete compressed asset ${compressedRelative}`);
        fs.unlinkSync(compressedPath);
    }
}

export function emitAssetUpdate() {
    readAssetFolder();
    getWebsocketServer().send("notify_assets_update", getParsedAssetFiles());
    emitSystemStorageUpdate()
}

export function listAssets(inputPath: string = ""): AssetListEntry[] {
    const directory = resolveAssetPath(inputPath);

    if (!fs.existsSync(directory)) {
        throw new Error("asset path not found");
    }

    const stat = fs.statSync(directory);

    if (!stat.isDirectory()) {
        throw new Error("asset path must be a folder");
    }

    return fs.readdirSync(directory, { withFileTypes: true })
        .map((entry): AssetListEntry => {
            const absPath = path.join(directory, entry.name);
            const entryStat = fs.statSync(absPath);
            const relPath = relativeAssetPath(absPath);

            return {
                name: entry.name,
                path: relPath,
                type: entry.isDirectory() ? "folder" : "file",
                size: entry.isFile() ? entryStat.size : undefined,
                modified: entryStat.mtime.toISOString(),
                asset: entry.isFile() ? getAssetFile(relPath) : undefined,
            };
        })
        .sort((a, b) => {
            if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
}


export function createAssetFolder(inputPath: string = "", name?: string) {
    const folderPath = name
        ? path.join(normalizeInputPath(inputPath), normalizeInputPath(name))
        : normalizeInputPath(inputPath);

    if (!folderPath) throw new Error("folder path missing");

    const target = resolveAssetPath(folderPath);

    if (fs.existsSync(target)) {
        throw new Error("folder already exists");
    }

    fs.mkdirSync(target, { recursive: true });

    const relPath = relativeAssetPath(target);

    emitAssetUpdate();

    return { path: relPath };
}

export function deleteAsset(inputPath: string) {
    if (!inputPath) throw new Error("path missing");

    const target = resolveAssetPath(inputPath);

    if (!fs.existsSync(target)) {
        throw new Error("asset not found");
    }

    const relPath = relativeAssetPath(target);
    const stat = fs.statSync(target);

    if (stat.isDirectory()) {
        fs.rmSync(target, { recursive: true, force: true });
        deleteCompressedFolder(relPath);
    } else {
        fs.unlinkSync(target);
        deleteCompressedForAsset(relPath);
    }

    emitAssetUpdate();

    return { path: relPath };
}

function deleteCompressedFolder(relativePath: string) {
    const compressedPath = path.resolve(compressedAssetRoot, relativePath);

    if (compressedPath !== compressedAssetRoot && !compressedPath.startsWith(`${compressedAssetRoot}${path.sep}`)) {
        return;
    }

    if (fs.existsSync(compressedPath)) {
        fs.rmSync(compressedPath, { recursive: true, force: true });
    }
}

export function moveAsset(source: string, target: string) {
    if (!source) throw new Error("source missing");
    if (!target) throw new Error("target missing");

    const sourcePath = resolveAssetPath(source);
    const targetPath = resolveAssetPath(target);

    if (!fs.existsSync(sourcePath)) {
        throw new Error("source asset not found");
    }

    if (fs.existsSync(targetPath)) {
        throw new Error("target already exists");
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.renameSync(sourcePath, targetPath);

    const sourceRel = relativeAssetPath(sourcePath);
    const targetRel = relativeAssetPath(targetPath);

    moveCompressedAsset(sourceRel, targetRel);

    emitAssetUpdate();

    return {
        source: sourceRel,
        target: targetRel,
    };
}

function moveCompressedAsset(sourceRel: string, targetRel: string) {
    const sourceCompressedRel = compressedRelativePath(sourceRel) ?? sourceRel;
    const targetCompressedRel = compressedRelativePath(targetRel) ?? targetRel;

    const sourceCompressed = path.resolve(compressedAssetRoot, sourceCompressedRel);
    const targetCompressed = path.resolve(compressedAssetRoot, targetCompressedRel);

    if (sourceCompressed !== compressedAssetRoot && !sourceCompressed.startsWith(`${compressedAssetRoot}${path.sep}`)) return;
    if (targetCompressed !== compressedAssetRoot && !targetCompressed.startsWith(`${compressedAssetRoot}${path.sep}`)) return;
    if (!fs.existsSync(sourceCompressed)) return;

    fs.mkdirSync(path.dirname(targetCompressed), { recursive: true });
    fs.renameSync(sourceCompressed, targetCompressed);
}

export async function compressAsset(inputPath: string) {
    if (!inputPath) throw new Error("path missing");

    const target = resolveAssetPath(inputPath);

    if (!fs.existsSync(target)) {
        throw new Error("asset not found");
    }

    if (fs.statSync(target).isDirectory()) {
        throw new Error("compress path must be a file");
    }

    await compressAssets(true, target);
    emitAssetUpdate();

    return { path: relativeAssetPath(target) };
}

export async function addAssetFilesFromUpload(files: any[], targetPath: string = "") {
    if (!files?.length) {
        throw new Error("no files uploaded");
    }

    const directory = resolveAssetPath(targetPath);
    fs.mkdirSync(directory, { recursive: true });

    const added = [];

    for (const file of files) {
        const originalName = path.basename(file.originalname || "upload.bin");
        const target = path.join(directory, originalName);

        if (!target.startsWith(`${assetRoot}${path.sep}`)) {
            logWarn(`invalid upload target skipped: ${originalName}`);
            continue;
        }

        fs.writeFileSync(target, file.buffer);

        const relPath = relativeAssetPath(target);
        added.push(relPath);
    }

    emitAssetUpdate();

    return added;
}

export type AssetStorageInfo = {
    root: string;
    used: number;
    total: number;
    free: number;
    available: number;
    assetUsed: number;
};

export function getAssetStorageInfo(): AssetStorageInfo {
    fs.mkdirSync(assetRoot, { recursive: true });
    fs.mkdirSync(compressedAssetRoot, { recursive: true });

    const statfs = fs.statfsSync(assetRoot);
    const total = Number(statfs.blocks) * Number(statfs.bsize);
    const free = Number(statfs.bfree) * Number(statfs.bsize);
    const available = Number(statfs.bavail) * Number(statfs.bsize);
    const used = Math.max(total - free, 0);

    return {
        root: assetRoot,
        used,
        total,
        free,
        available,
        assetUsed: getDirectorySize(assetRoot),
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
        } catch (error) {
            logWarn(`failed to read asset storage size for ${fullPath}`);
        }
    }

    return size;
}
