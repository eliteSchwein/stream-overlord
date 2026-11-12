import {spawn} from "node:child_process";

export type UpdateProgressStage =
    | "preparing"
    | "downloading"
    | "extracting"
    | "installing"
    | "configuring"
    | "pulling"
    | "dependencies"
    | "verifying"
    | "restarting";

export type UpdateProgress = {
    stage: UpdateProgressStage;
    // Overall progress of the manager update (0-100). Undefined = indeterminate.
    percent?: number;
    // Package currently processed (apt based managers).
    package?: string;
    // 1-based index of the current package and total package count.
    package_index?: number;
    package_total?: number;
    // Progress of the current package (0-100) if known.
    package_percent?: number;
    // Raw status text of the running tool (e.g. "Unpacking libfoo").
    message?: string;
};

export type ProgressCallback = (progress: UpdateProgress) => void;

function clampPercent(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

/**
 * Maps a percentage of a sub step into a range of the overall progress.
 */
export function scalePercent(percent: number, from: number, to: number): number {
    return clampPercent(from + (to - from) * (clampPercent(percent) / 100));
}

export type StreamingOptions = {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    onLine?: (line: string, stream: "stdout" | "stderr") => void;
};

/**
 * Like execFile, but streams stdout/stderr line by line. Carriage returns are
 * treated as line breaks so progress meters (curl, git) are reported live.
 */
export function runStreaming(command: string, args: string[], options: StreamingOptions = {}): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: options.cwd,
            env: options.env ?? process.env,
            stdio: ["ignore", "pipe", "pipe"],
        });

        let stdout = "";
        let stderrTail = "";
        const buffers = {stdout: "", stderr: ""};

        const handleChunk = (stream: "stdout" | "stderr", chunk: Buffer) => {
            const text = chunk.toString("utf8");

            if (stream === "stdout") {
                // Same cap as the previous execFile maxBuffer.
                if (stdout.length < 8 * 1024 * 1024) stdout += text;
            } else {
                stderrTail = (stderrTail + text).slice(-8192);
            }

            buffers[stream] += text;
            const parts = buffers[stream].split(/\r\n|\r|\n/);
            buffers[stream] = parts.pop() ?? "";

            for (const part of parts) {
                const line = part.trim();
                if (line) options.onLine?.(line, stream);
            }
        };

        child.stdout.on("data", (chunk: Buffer) => handleChunk("stdout", chunk));
        child.stderr.on("data", (chunk: Buffer) => handleChunk("stderr", chunk));

        child.on("error", reject);
        child.on("close", (code, signal) => {
            for (const stream of ["stdout", "stderr"] as const) {
                const line = buffers[stream].trim();
                if (line) options.onLine?.(line, stream);
            }

            if (code === 0) {
                resolve(stdout.trim());
                return;
            }

            const reason = signal ? `signal ${signal}` : `exit code ${code}`;
            const details = stderrTail.replace(/\r(?!\n)/g, "\n").trim();
            reject(new Error(
                `Command failed (${reason}): ${command} ${args.join(" ")}`
                + (details ? `\n${details}` : ""),
            ));
        });
    });
}

/**
 * Parses the trailing percentage of a progress line, e.g. curl's
 * "######   45.3%" progress bar.
 */
export function parsePercent(line: string): number | undefined {
    const match = line.match(/(\d{1,3}(?:[.,]\d+)?)\s*%/);
    if (!match) return undefined;

    const value = Number(match[1].replace(",", "."));
    return Number.isFinite(value) && value <= 100 ? value : undefined;
}

// ---------------------------------------------------------------------------
// apt
// ---------------------------------------------------------------------------

// Download share of the overall apt progress; dpkg gets the rest.
const APT_DOWNLOAD_WEIGHT = 40;

function aptPackagePercent(message: string): number | undefined {
    const normalized = message.toLowerCase();

    if (normalized.startsWith("installed") || normalized.startsWith("removed")) return 100;
    if (normalized.startsWith("configuring")) return 80;
    if (normalized.startsWith("preparing to configure")) return 60;
    if (normalized.startsWith("unpacking")) return 35;
    if (normalized.startsWith("preparing")) return 10;

    return undefined;
}

/**
 * Builds the args/env for an apt-get call that reports machine readable
 * progress on stdout (APT::Status-Fd) and a matching line parser.
 */
export function createAptProgressTracker(expectedPackages: string[], onProgress: ProgressCallback) {
    const seen: string[] = [];
    let downloadPercent = 0;

    const total = () => Math.max(expectedPackages.length, seen.length, 1);

    const onLine = (line: string) => {
        // dlstatus:<n>:<percent>:<message>
        // pmstatus:<package>:<percent>:<message>
        // The second field may contain colons (multiarch "libc6:amd64"), so
        // anchor on the numeric percent field instead.
        const match = line.match(/^(dlstatus|pmstatus|pmerror|pmconffile):(.*?):(\d+(?:\.\d+)?):(.*)$/);
        if (!match) return;

        const [, kind, field, percentRaw, message] = match;
        const percent = Number(percentRaw);

        if (kind === "dlstatus") {
            downloadPercent = Number.isFinite(percent) ? percent : downloadPercent;
            onProgress({
                stage: "downloading",
                percent: scalePercent(downloadPercent, 0, APT_DOWNLOAD_WEIGHT),
                package_total: total(),
                message: message.trim(),
            });
            return;
        }

        if (kind !== "pmstatus") return;

        const packageName = field.trim().split(":")[0];
        if (!packageName || packageName.startsWith("dpkg-exec")) {
            onProgress({
                stage: "configuring",
                percent: scalePercent(percent, APT_DOWNLOAD_WEIGHT, 100),
                package_total: total(),
                message: message.trim(),
            });
            return;
        }

        if (!seen.includes(packageName)) seen.push(packageName);

        const packagePercent = aptPackagePercent(message.trim());
        const configuring = /configur|installed/i.test(message);

        onProgress({
            stage: configuring ? "configuring" : "installing",
            percent: scalePercent(percent, APT_DOWNLOAD_WEIGHT, 100),
            package: packageName,
            package_index: seen.indexOf(packageName) + 1,
            package_total: total(),
            package_percent: packagePercent,
            message: message.trim(),
        });
    };

    return {
        args: ["-o", "APT::Status-Fd=1", "-o", "Dpkg::Use-Pty=0"],
        // Status messages are matched in English.
        env: {...process.env, LC_ALL: "C", LANG: "C"},
        onLine,
    };
}

// ---------------------------------------------------------------------------
// git
// ---------------------------------------------------------------------------

const GIT_PHASES: Array<{pattern: RegExp; from: number; to: number}> = [
    {pattern: /^(remote: )?(enumerating|counting) objects/i, from: 0, to: 5},
    {pattern: /^(remote: )?compressing objects/i, from: 5, to: 15},
    {pattern: /^receiving objects/i, from: 15, to: 80},
    {pattern: /^resolving deltas/i, from: 80, to: 95},
    {pattern: /^(updating files|checking out files)/i, from: 95, to: 100},
];

/**
 * Parses `git pull --progress` output into a 0-100 percentage of the pull.
 */
export function parseGitProgress(line: string): {percent: number; message: string} | undefined {
    for (const phase of GIT_PHASES) {
        if (!phase.pattern.test(line)) continue;

        const percent = parsePercent(line) ?? 0;
        return {
            percent: scalePercent(percent, phase.from, phase.to),
            message: line.replace(/,\s*done\.?$/i, "").trim(),
        };
    }

    return undefined;
}
