import * as fs from "node:fs";
import * as path from "node:path";
import {getSystemConfigDirectory} from "./ConfigHelper";
import {logWarn} from "./LogHelper";

export type CustomStyleMode = "css" | "scss";

export type FontEntry = {
    name: string;
    path: string;
    url: string;
    family: string;
    className: string;
    weight: number;
    style: "normal" | "italic";
    size: number;
    modified: string;
};

const customizationRoot = path.join(getSystemConfigDirectory(), "streambot-customization");
export const fontsRoot = path.join(customizationRoot, "fonts");

const sourcePath = path.join(customizationRoot, "custom.scss");
const modePath = path.join(customizationRoot, "mode.txt");

const fontExtensions = new Set([
    ".ttf",
    ".otf",
    ".woff",
    ".woff2",
    ".eot",
]);

let cachedCustomCss = "";
let cachedCustomSignature = "";
let customCompilePromise: Promise<string> | null = null;

let cachedFontCss = "";
let cachedFontSignature = "";

function ensureDirectories() {
    fs.mkdirSync(customizationRoot, {recursive: true});
    fs.mkdirSync(fontsRoot, {recursive: true});
}

function normalizeMode(value: unknown): CustomStyleMode {
    return String(value).toLowerCase() === "scss" ? "scss" : "css";
}

export function getCustomStyleMode(): CustomStyleMode {
    ensureDirectories();

    try {
        return normalizeMode(fs.readFileSync(modePath, "utf8").trim());
    } catch {
        return "css";
    }
}

export function readCustomStyle() {
    ensureDirectories();

    return {
        mode: getCustomStyleMode(),
        content: fs.existsSync(sourcePath)
            ? fs.readFileSync(sourcePath, "utf8")
            : "",
    };
}

export async function saveCustomStyle(content: string, mode: CustomStyleMode = "css") {
    ensureDirectories();

    if (typeof content !== "string") {
        throw new Error("custom style content must be a string");
    }

    const normalizedMode = normalizeMode(mode);

    // Compile first, so invalid SCSS never replaces the last working source.
    await compileStyle(content, normalizedMode);

    fs.writeFileSync(sourcePath, content, "utf8");
    fs.writeFileSync(modePath, normalizedMode, "utf8");

    invalidateCustomStyleCache();

    return {
        mode: normalizedMode,
        size: Buffer.byteLength(content),
        css: await getCompiledCustomCss(),
    };
}

export function invalidateCustomStyleCache() {
    cachedCustomSignature = "";
    cachedCustomCss = "";
    customCompilePromise = null;
}

export function invalidateFontCssCache() {
    cachedFontSignature = "";
    cachedFontCss = "";
}

function getCustomStyleSignature(): string {
    ensureDirectories();

    const sourceStat = fs.existsSync(sourcePath) ? fs.statSync(sourcePath) : null;
    const modeStat = fs.existsSync(modePath) ? fs.statSync(modePath) : null;

    return [
        sourceStat?.mtimeMs ?? 0,
        sourceStat?.size ?? 0,
        modeStat?.mtimeMs ?? 0,
        modeStat?.size ?? 0,
    ].join("|");
}

function getFontSignature(): string {
    return listFontFiles()
        .map(font => `${font.path}:${font.size}:${font.modified}`)
        .join("|");
}

async function compileStyle(content: string, mode: CustomStyleMode): Promise<string> {
    if (mode === "css") return content;

    try {
        const sass = await import("sass");
        const result = sass.compileString(content, {
            style: "expanded",
            loadPaths: [customizationRoot, fontsRoot],
        });

        return result.css;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`SCSS compilation failed: ${message}`);
    }
}

export async function getCompiledCustomCss(): Promise<string> {
    ensureDirectories();

    const signature = getCustomStyleSignature();

    if (signature === cachedCustomSignature) {
        return cachedCustomCss;
    }

    if (customCompilePromise) {
        return customCompilePromise;
    }

    customCompilePromise = (async () => {
        const {content, mode} = readCustomStyle();

        cachedCustomCss = await compileStyle(content, mode);
        cachedCustomSignature = getCustomStyleSignature();
        customCompilePromise = null;

        return cachedCustomCss;
    })().catch(error => {
        customCompilePromise = null;
        throw error;
    });

    return customCompilePromise;
}

function sanitizeRelativePath(value: string): string {
    return String(value || "")
        .replace(/\\/g, "/")
        .split("/")
        .filter(part => part && part !== "." && part !== "..")
        .join("/");
}

function resolveFontPath(relativePath: string): string {
    ensureDirectories();

    const normalized = sanitizeRelativePath(relativePath);
    if (!normalized) throw new Error("font path missing");

    const resolved = path.resolve(fontsRoot, normalized);
    if (resolved !== fontsRoot && !resolved.startsWith(`${fontsRoot}${path.sep}`)) {
        throw new Error("font path must stay inside fonts directory");
    }

    return resolved;
}

function slugify(value: string): string {
    return value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase() || "font";
}

function humanize(value: string): string {
    return value
        .replace(/[_-]+/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/\s+/g, " ")
        .trim();
}

function inferFamily(relativePath: string): string {
    const normalized = sanitizeRelativePath(relativePath);
    const parts = normalized.split("/").filter(Boolean);

    if (parts.length > 1) {
        return humanize(parts[0]);
    }

    const stem = path.basename(normalized, path.extname(normalized))
        .replace(
            /[-_ ]?(thin|extralight|extra-light|ultralight|ultra-light|light|regular|normal|medium|semibold|semi-bold|demibold|demi-bold|bold|extrabold|extra-bold|ultrabold|ultra-bold|black|heavy|italic|oblique)+$/i,
            "",
        );

    return humanize(stem || path.basename(normalized, path.extname(normalized)));
}

function inferWeight(fileName: string): number {
    const name = fileName.toLowerCase();

    if (/thin/.test(name)) return 100;
    if (/extra[-_ ]?light|ultra[-_ ]?light/.test(name)) return 200;
    if (/(^|[-_ ])light/.test(name)) return 300;
    if (/medium/.test(name)) return 500;
    if (/semi[-_ ]?bold|demi[-_ ]?bold/.test(name)) return 600;
    if (/extra[-_ ]?bold|ultra[-_ ]?bold/.test(name)) return 800;
    if (/black|heavy/.test(name)) return 900;
    if (/bold/.test(name)) return 700;

    return 400;
}

function inferStyle(fileName: string): "normal" | "italic" {
    return /italic|oblique/i.test(fileName) ? "italic" : "normal";
}

function cssFormat(ext: string): string | null {
    switch (ext.toLowerCase()) {
        case ".woff2": return "woff2";
        case ".woff": return "woff";
        case ".ttf": return "truetype";
        case ".otf": return "opentype";
        case ".eot": return "embedded-opentype";
        default: return null;
    }
}

function walkFonts(directory: string, prefix = ""): FontEntry[] {
    if (!fs.existsSync(directory)) return [];

    const result: FontEntry[] = [];

    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
        const relativePath = sanitizeRelativePath(path.posix.join(prefix, entry.name));
        const fullPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            result.push(...walkFonts(fullPath, relativePath));
            continue;
        }

        if (!entry.isFile()) continue;

        const ext = path.extname(entry.name).toLowerCase();
        if (!fontExtensions.has(ext)) continue;

        const stat = fs.statSync(fullPath);
        const family = inferFamily(relativePath);

        result.push({
            name: entry.name,
            path: relativePath,
            url: `/fonts/${relativePath.split("/").map(encodeURIComponent).join("/")}`,
            family,
            className: `font-${slugify(family)}`,
            weight: inferWeight(entry.name),
            style: inferStyle(entry.name),
            size: stat.size,
            modified: stat.mtime.toISOString(),
        });
    }

    return result;
}

export function listFontFiles(): FontEntry[] {
    ensureDirectories();

    return walkFonts(fontsRoot).sort((a, b) =>
        a.family.localeCompare(b.family) ||
        a.weight - b.weight ||
        a.path.localeCompare(b.path)
    );
}

export function generateFontCss(): string {
    const fonts = listFontFiles();
    if (!fonts.length) return "";

    const faces = fonts.map(font => {
        const format = cssFormat(path.extname(font.name));
        const source = format
            ? `url("${font.url}") format("${format}")`
            : `url("${font.url}")`;

        return [
            "@font-face {",
            `    font-family: "${font.family.replace(/"/g, '\\"')}";`,
            `    src: ${source};`,
            `    font-weight: ${font.weight};`,
            `    font-style: ${font.style};`,
            "    font-display: swap;",
            "}",
        ].join("\n");
    });

    const seen = new Set<string>();
    const classes: string[] = [];

    for (const font of fonts) {
        if (seen.has(font.className)) continue;
        seen.add(font.className);

        classes.push([
            `.${font.className} {`,
            `    font-family: "${font.family.replace(/"/g, '\\"')}", sans-serif;`,
            "}",
        ].join("\n"));
    }

    return [...faces, ...classes].join("\n\n");
}

export function getGeneratedFontCss(): string {
    ensureDirectories();

    const signature = getFontSignature();
    if (signature === cachedFontSignature) {
        return cachedFontCss;
    }

    cachedFontCss = generateFontCss();
    cachedFontSignature = signature;

    return cachedFontCss;
}

export function addFontFile(fileName: string, buffer: Buffer, targetFolder = "") {
    ensureDirectories();

    const ext = path.extname(fileName).toLowerCase();
    if (!fontExtensions.has(ext)) {
        throw new Error(`unsupported font type: ${ext || "unknown"}`);
    }

    const safeName = path.basename(fileName);
    const relativePath = sanitizeRelativePath(path.posix.join(targetFolder, safeName));
    const target = resolveFontPath(relativePath);

    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, buffer);

    invalidateFontCssCache();

    return relativePath;
}

export async function addFontUpload(
    fileName: string,
    buffer: Buffer,
    targetFolder = "",
): Promise<string[]> {
    const ext = path.extname(fileName).toLowerCase();

    if (fontExtensions.has(ext)) {
        return [addFontFile(fileName, buffer, targetFolder)];
    }

    if (ext !== ".zip") {
        throw new Error("only TTF, OTF, WOFF, WOFF2, EOT and ZIP files are supported");
    }

    let zip: any;

    try {
        const imported = await import("adm-zip");
        const AdmZip = (imported as any).default ?? imported;
        zip = new AdmZip(buffer);
    } catch (error) {
        throw new Error(
            `ZIP support requires the "adm-zip" package: ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
    }

    const zipBase = path.basename(fileName, ext)
        .replace(/[^a-zA-Z0-9._ -]+/g, "-")
        .replace(/^\.+|\.+$/g, "")
        .trim() || "font-pack";

    const fontEntries = zip.getEntries()
        .filter((entry: any) => !entry.isDirectory)
        .map((entry: any) => ({
            entry,
            entryPath: sanitizeRelativePath(entry.entryName),
        }))
        .filter(({entryPath}: {entryPath: string}) =>
            entryPath && fontExtensions.has(path.extname(entryPath).toLowerCase())
        );

    const topLevelFolders = new Set(
        fontEntries
            .map(({entryPath}: {entryPath: string}) => entryPath.split("/"))
            .filter((parts: string[]) => parts.length > 1)
            .map((parts: string[]) => parts[0]),
    );

    const everyFontHasFolder = fontEntries.every(
        ({entryPath}: {entryPath: string}) => entryPath.includes("/"),
    );

    // Keep a meaningful archive root (e.g. Orbitron/...), otherwise group flat
    // archives below the ZIP filename so their family can be derived cleanly.
    const preserveArchiveRoot = everyFontHasFolder && topLevelFolders.size === 1;

    const added: string[] = [];

    for (const {entry, entryPath} of fontEntries) {
        const storedPath = preserveArchiveRoot
            ? entryPath
            : path.posix.join(zipBase, entryPath);

        const relativePath = sanitizeRelativePath(
            path.posix.join(targetFolder, storedPath),
        );

        const target = resolveFontPath(relativePath);
        fs.mkdirSync(path.dirname(target), {recursive: true});
        fs.writeFileSync(target, entry.getData());
        added.push(relativePath);
    }

    if (!added.length) {
        throw new Error("ZIP did not contain any supported font files");
    }

    invalidateFontCssCache();

    return added;
}

export function deleteFont(relativePath: string) {
    const target = resolveFontPath(relativePath);

    if (!fs.existsSync(target)) {
        throw new Error("font not found");
    }

    const stat = fs.statSync(target);

    if (stat.isDirectory()) {
        fs.rmSync(target, {recursive: true, force: true});
    } else {
        fs.unlinkSync(target);
    }

    // Clean up now-empty parent directories.
    let current = path.dirname(target);
    while (current.startsWith(fontsRoot) && current !== fontsRoot) {
        try {
            if (fs.readdirSync(current).length > 0) break;
            fs.rmdirSync(current);
            current = path.dirname(current);
        } catch (error) {
            logWarn(`failed to clean empty font directory: ${String(error)}`);
            break;
        }
    }

    invalidateFontCssCache();
}
