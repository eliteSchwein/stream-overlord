import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {logRegular, logWarn} from "../LogHelper";
import {spawn} from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import fillTemplate from "../TemplateHelper";
import {emitAssetUpdate, resolveAssetPath} from "../AssetManagementHelper";

function parseFfmpegArguments(value: string): string[] {
    const input = String(value ?? "").trim();
    if (!input) return [];

    const result: string[] = [];
    let current = "";
    let quote: "'" | '"' | null = null;
    let escaped = false;

    for (const char of input) {
        if (escaped) {
            current += char;
            escaped = false;
            continue;
        }

        if (char === "\\") {
            escaped = true;
            continue;
        }

        if (quote) {
            if (char === quote) {
                quote = null;
            } else {
                current += char;
            }
            continue;
        }

        if (char === "'" || char === '"') {
            quote = char;
            continue;
        }

        if (/\s/.test(char)) {
            if (current) {
                result.push(current);
                current = "";
            }
            continue;
        }

        current += char;
    }

    if (escaped) current += "\\";

    if (quote) {
        throw new Error("unterminated quote in ffmpeg arguments");
    }

    if (current) result.push(current);

    return result;
}

function runFfmpeg(args: string[]): Promise<boolean> {
    return new Promise((resolve) => {
        const process = spawn("ffmpeg", args, {
            stdio: ["ignore", "ignore", "pipe"],
        });

        let stderr = "";

        process.stderr?.on("data", (chunk) => {
            stderr += String(chunk);
        });

        process.on("error", (error) => {
            logWarn(`ffmpeg failed to start: ${error.message}`);
            resolve(false);
        });

        process.on("close", (code) => {
            if (code === 0) {
                resolve(true);
                return;
            }

            logWarn(`ffmpeg exited with status ${String(code)}`);

            const details = stderr.trim();
            if (details) {
                logWarn(details);
            }

            resolve(false);
        });
    });
}

export default class MediaMacroTask extends BaseMacroTask {
    channel = "media"

    async handle(method: string, data: any = {}, variables: any = {}) {
        logRegular(`trigger media: ${method}`);

        switch (method) {
            case "show_media": {
                if (!data.path) {
                    logWarn(`media show_media requires path`);
                    break;
                }

                const options = data.options && typeof data.options === "object"
                    ? data.options
                    : {};

                this.websocket.send("notify_media_update", {
                    media: method,
                    ...options,
                    target: data.target ?? options.target ?? "default",
                    path: data.path,
                    type: data.type ?? options.type,
                    clearOnEmpty: data.clearOnEmpty ?? options.clearOnEmpty,
                    autoplay: data.autoplay ?? options.autoplay,
                    loop: data.loop ?? options.loop,
                    muted: data.muted ?? options.muted,
                    controls: data.controls ?? options.controls,
                });

                break;
            }

            case "clear_media": {
                this.websocket.send("notify_media_update", {
                    media: method,
                    target: data.target ?? "default",
                });

                break;
            }

            case "ffmpeg": {
                await this.handleFfmpeg(data, variables);
                break;
            }

            default: {
                logWarn(`invalid media method: ${method}`);
                break;
            }
        }
    }

    private async handleFfmpeg(data: any = {}, variables: any = {}) {
        const render = (value: unknown) => fillTemplate(String(value ?? ""), {...data, ...variables, variables}).trim();

        const configuredInput = render(data.input);
        const filename = path.basename(render(data.output_filename ?? data.filename));
        const filterInputs = Array.isArray(data.filter_inputs)
            ? data.filter_inputs
            : Array.isArray(data.filterInputs)
                ? data.filterInputs
                : [];
        const resultVariable = String(data.result_variable ?? "").trim();
        const temporaryFile = data.temporary_file === true || data.temporaryFile === true;

        if (!configuredInput) {
            logWarn("media ffmpeg requires input");
            return;
        }

        if (!filename || filename === "." || filename === "..") {
            logWarn("media ffmpeg requires output filename");
            return;
        }

        if (!resultVariable) {
            logWarn("media ffmpeg requires result_variable");
            return;
        }

        const resolveInputPath = (value: string, label: string): string | undefined => {
            if (path.isAbsolute(value)) {
                const normalized = path.resolve(value);

                if (normalized !== "/tmp" && !normalized.startsWith(`/tmp${path.sep}`)) {
                    logWarn(`media ffmpeg absolute ${label} must be inside /tmp: ${normalized}`);
                    return undefined;
                }

                return normalized;
            }

            try {
                return resolveAssetPath(value);
            } catch (error: any) {
                logWarn(`media ffmpeg invalid ${label} path: ${error?.message ?? error}`);
                return undefined;
            }
        };

        const validateInputFile = (filePath: string, label: string): boolean => {
            if (!fs.existsSync(filePath)) {
                logWarn(`media ffmpeg ${label} file not found: ${filePath}`);
                return false;
            }

            try {
                if (!fs.statSync(filePath).isFile()) {
                    logWarn(`media ffmpeg ${label} is not a file: ${filePath}`);
                    return false;
                }
            } catch (error: any) {
                logWarn(`media ffmpeg failed to inspect ${label}: ${error?.message ?? error}`);
                return false;
            }

            return true;
        };

        const inputPath = resolveInputPath(configuredInput, "input");
        if (!inputPath || !validateInputFile(inputPath, "input")) {
            return;
        }

        for (let index = 0; index < filterInputs.length; index++) {
            const entry = filterInputs[index] ?? {};
            const configuredPath = render(entry.path ?? entry.input ?? entry.file);
            const variable = String(entry.variable ?? entry.key ?? "").trim();

            if (!configuredPath) {
                logWarn(`media ffmpeg filter input ${index + 1} requires path`);
                return;
            }

            if (!variable) {
                logWarn(`media ffmpeg filter input ${index + 1} requires variable`);
                return;
            }

            const resolved = resolveInputPath(configuredPath, `filter input ${index + 1}`);

            if (!resolved || !validateInputFile(resolved, `filter input ${index + 1}`)) {
                return;
            }

            variables[variable] = resolved;
        }

        let outputPath: string;

        if (temporaryFile) {
            outputPath = path.join("/tmp", filename);
        } else {
            const folder = render(data.output_folder ?? data.folder);

            try {
                outputPath = resolveAssetPath(path.posix.join(folder.replace(/\\/g, "/"), filename));
            } catch (error: any) {
                logWarn(`media ffmpeg invalid output path: ${error?.message ?? error}`);
                return;
            }
        }

        try {
            fs.mkdirSync(path.dirname(outputPath), {recursive: true});
        } catch (error: any) {
            logWarn(`media ffmpeg failed to create output folder: ${error?.message ?? error}`);
            return;
        }

        let customArguments: string[];

        try {
            customArguments = parseFfmpegArguments(render(data.arguments));
        } catch (error: any) {
            logWarn(`media ffmpeg invalid arguments: ${error?.message ?? error}`);
            return;
        }

        const args = [
            "-y",
            "-i", inputPath,
            ...customArguments,
            outputPath,
        ];

        logRegular(`ffmpeg ${inputPath} -> ${outputPath}`);

        const success = await runFfmpeg(args);

        if (!success) {
            return;
        }

        variables[resultVariable] = outputPath;

        if (!temporaryFile) {
            emitAssetUpdate();
        }

        logRegular(`media ffmpeg ${resultVariable}=${outputPath}`);
    }
}
