import * as fs from "node:fs";
import * as path from "node:path";
import { getSystemConfigDirectory } from "./ConfigHelper";
import { assetRoot } from "./AssetManagementHelper";
import { overlayRoot } from "./OverlayManagementHelper";
import { logWarn } from "./LogHelper";
import {getRegularMusicPath} from "./MusicHelper";
import {getMacroDirectory} from "./MacroHelper";

export type SystemStorageInfo = {
    root: string;
    used: number;
    total: number;
    free: number;
    available: number;
    folders: {
        assets: number;
        overlays: number;
        music: number;
        macros: number;
    };
};

export function getSystemStorageInfo(): SystemStorageInfo {
    const root = getSystemConfigDirectory();

    fs.mkdirSync(root, { recursive: true });
    fs.mkdirSync(assetRoot, { recursive: true });
    fs.mkdirSync(overlayRoot, { recursive: true });

    const statfs = fs.statfsSync(root);

    const total = Number(statfs.blocks) * Number(statfs.bsize);
    const free = Number(statfs.bfree) * Number(statfs.bsize);
    const available = Number(statfs.bavail) * Number(statfs.bsize);
    const used = Math.max(total - free, 0);

    return {
        root,
        used,
        total,
        free,
        available,
        folders: {
            assets: getDirectorySize(assetRoot),
            overlays: getDirectorySize(overlayRoot),
            music: getDirectorySize(getRegularMusicPath()),
            macros: getDirectorySize(getMacroDirectory()),
        },
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
            logWarn(`failed to read storage size for ${fullPath}`);
        }
    }

    return size;
}