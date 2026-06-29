import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {getSystemConfigDirectory} from "../ConfigHelper";
import {logRegular, logWarn} from "../LogHelper";
import fs from "fs";
import path from "path";

function getAssetDirectory() {
    return path.join(getSystemConfigDirectory(), "assets");
}

function normalizeAssetReadPath(inputPath: string = "") {
    const normalized = path.normalize(String(inputPath || "")).replace(/^([/\\])+/, "");

    if (normalized === ".") return "";

    if (normalized.split(path.sep).includes("..")) {
        throw new Error("invalid asset path");
    }

    return normalized;
}

function resolveAssetReadPath(inputPath: string = "") {
    const baseDirectory = getAssetDirectory();
    const resolvedPath = path.resolve(baseDirectory, normalizeAssetReadPath(inputPath));

    if (resolvedPath !== baseDirectory && !resolvedPath.startsWith(`${baseDirectory}${path.sep}`)) {
        throw new Error("invalid asset path");
    }

    return resolvedPath;
}

function normalizeFileExtension(fileExtension: string = "") {
    const extension = String(fileExtension || "").trim().toLowerCase();

    if (!extension) return "";

    return extension.startsWith(".") ? extension : `.${extension}`;
}

export default class FileMacroTask extends BaseMacroTask {
    channel = "file"

    async handle(method: string, data: any = {}, variables: any = {}) {
        logRegular(`trigger file: ${method}`);

        switch (method) {
            case "read_folder": {
                const directory = resolveAssetReadPath(data.path ?? "");
                const variableKey = data.key ?? "files";
                const fileExtension = normalizeFileExtension(data.fileExtension ?? data.file_extension ?? "");

                if (!fs.existsSync(directory)) {
                    logWarn(`file read_folder asset path not found: ${data.path ?? ""}`);
                    variables[variableKey] = [];
                    break;
                }

                if (!fs.statSync(directory).isDirectory()) {
                    logWarn(`file read_folder asset path is not a directory: ${data.path ?? ""}`);
                    variables[variableKey] = [];
                    break;
                }

                const files = fs.readdirSync(directory, {withFileTypes: true})
                    .filter(entry => entry.isFile())
                    .filter(entry => !fileExtension || path.extname(entry.name).toLowerCase() === fileExtension)
                    .map(entry => {
                        const relativePath = path
                            .join(normalizeAssetReadPath(data.path ?? ""), entry.name)
                            .replace(/\\/g, "/");

                        return {
                            name: entry.name,
                            path: relativePath,
                            extension: path.extname(entry.name).replace(/^\./, ""),
                        };
                    })
                    .sort((a, b) => a.name.localeCompare(b.name));

                variables[variableKey] = files;

                logRegular(`file read_folder ${variableKey}=${files.length} file(s)`);
                break;
            }

            default: {
                logWarn(`invalid file method: ${method}`);
                break;
            }
        }
    }
}
