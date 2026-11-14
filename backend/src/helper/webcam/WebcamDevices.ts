import {execFile} from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import {promisify} from "node:util";

const execFileAsync = promisify(execFile);

export type WebcamFormat = {
    // V4L2 fourcc, e.g. MJPG, YUYV, H264
    fourcc: string;
    // "1280x720" -> highest fps available at that size
    sizes: Record<string, number>;
};

export type WebcamDevice = {
    // Stable path used in the settings: /dev/v4l/by-id/... (unique per camera
    // model + serial), else /dev/v4l/by-path/... (USB port), else /dev/videoN.
    path: string;
    // Current kernel node, e.g. /dev/video0 (changes between reconnects).
    node: string;
    stable: "by-id" | "by-path" | "node";
    name: string;
    formats: WebcamFormat[];
};

export type AudioSource = {
    name: string;
    description: string;
};

export type CoralDevice = {
    // libedgetpu device id: "usb:0", "usb:1", ... or "pci:0", ...
    id: string;
    type: "usb" | "pci";
    // Device node, e.g. /dev/bus/usb/001/027 or /dev/apex_0.
    node: string;
    // The bot user can open it (udev rule / apex group in place).
    accessible: boolean;
};

export type GpuInfo = {
    vendor: "nvidia" | "intel" | "amd" | null;
    // onnxruntime GPU runtime the blur installer set up: "cuda",
    // "openvino", "rocm"; null = detection on the GPU is not available.
    runtime: string | null;
};

export type WebcamAccelerators = {
    corals: CoralDevice[];
    gpu: GpuInfo;
    // Rockchip SoC with NPU, e.g. "rk3588"
    rockchip_npu: string | null;
};

async function run(command: string, args: string[]) {
    const {stdout} = await execFileAsync(command, args, {
        encoding: "utf8",
        timeout: 10_000,
        maxBuffer: 4 * 1024 * 1024,
    });
    return stdout;
}

function readSysfs(file: string) {
    try {
        return fs.readFileSync(file, "utf8").trim();
    } catch {
        return "";
    }
}

/**
 * Parses `v4l2-ctl --list-formats-ext` into formats with their frame sizes
 * and the highest frame rate per size.
 */
export function parseV4l2Formats(output: string): WebcamFormat[] {
    const formats: WebcamFormat[] = [];
    let current: WebcamFormat | null = null;
    let size = "";

    for (const line of output.split("\n")) {
        const format = line.match(/\[\d+\]:\s*'([^']+)'/);
        if (format) {
            current = {fourcc: format[1].trim(), sizes: {}};
            formats.push(current);
            size = "";
            continue;
        }

        const discrete = line.match(/Size:\s*Discrete\s+(\d+x\d+)/);
        if (discrete && current) {
            size = discrete[1];
            current.sizes[size] ??= 0;
            continue;
        }

        const interval = line.match(/Interval:.*\(([\d.]+)\s*fps\)/);
        if (interval && current && size) {
            current.sizes[size] = Math.max(current.sizes[size], Math.round(Number(interval[1])));
        }
    }

    return formats.filter((entry) => Object.keys(entry.sizes).length > 0);
}

/**
 * Maps /dev/videoN to its udev symlinks in /dev/v4l/<kind>. Only links of
 * the capture interface (index0) are used.
 */
function stableLinks(kind: "by-id" | "by-path") {
    const links = new Map<string, string[]>();
    const directory = `/dev/v4l/${kind}`;

    let entries: string[] = [];
    try {
        entries = fs.readdirSync(directory).sort();
    } catch {
        return links;
    }

    for (const entry of entries) {
        if (!entry.endsWith("-video-index0")) continue;
        // by-path has a legacy "usb-" and a newer "usbv2-" alias per port.
        if (kind === "by-path" && entry.includes("-usbv2-")) continue;
        try {
            const node = fs.realpathSync(path.join(directory, entry));
            links.set(node, [...(links.get(node) ?? []), path.join(directory, entry)]);
        } catch {
            // dangling link while the device disappears
        }
    }

    return links;
}

/** Resolves a configured device path (stable link or node) to /dev/videoN. */
export function resolveDeviceNode(devicePath: string) {
    try {
        return fs.realpathSync(devicePath);
    } catch {
        return null;
    }
}

/**
 * USB (UVC) webcams. Other V4L2 nodes (Pi codec/ISP nodes, Rockchip
 * decoders, raw CSI sensors that need libcamera) are skipped.
 */
export async function listWebcams(): Promise<WebcamDevice[]> {
    let entries: string[] = [];
    try {
        entries = fs.readdirSync("/sys/class/video4linux").filter((entry) => entry.startsWith("video"));
    } catch {
        return [];
    }

    const found: Array<WebcamDevice & {usbIdentity: string}> = [];
    const byId = stableLinks("by-id");
    const byPath = stableLinks("by-path");

    for (const entry of entries.sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)))) {
        const base = `/sys/class/video4linux/${entry}`;
        let driver = "";
        try {
            driver = path.basename(fs.realpathSync(`${base}/device/driver`));
        } catch {
            // no driver link
        }

        // UVC exposes a capture node (index 0) and a metadata node per camera.
        if (driver !== "uvcvideo" || readSysfs(`${base}/index`) !== "0") continue;

        const node = `/dev/${entry}`;
        let formats: WebcamFormat[] = [];
        try {
            formats = parseV4l2Formats(await run("v4l2-ctl", ["-d", node, "--list-formats-ext"]));
        } catch {
            // v4l2-ctl missing: the device is still usable with the default format
        }

        found.push({
            path: node,
            node,
            stable: "node",
            name: cleanName(readSysfs(`${base}/name`)) || entry,
            formats,
            usbIdentity: usbIdentity(base),
        });
    }

    // by-id names are built from vendor, model and serial. Cheap cameras ship
    // without a serial or with a placeholder one ("SN0001"), so two of them
    // share one by-id name and udev links it to only one of them. Such
    // cameras are identified by their USB port (by-path) instead.
    const identityCount = new Map<string, number>();
    for (const device of found) {
        identityCount.set(device.usbIdentity, (identityCount.get(device.usbIdentity) ?? 0) + 1);
    }

    return found.map(({usbIdentity: identity, ...device}) => {
        const idLink = byId.get(device.node)?.[0];
        const pathLink = byPath.get(device.node)?.[0];
        const uniqueId = identity !== "" && identityCount.get(identity) === 1;

        if (idLink && uniqueId) return {...device, path: idLink, stable: "by-id" as const};
        if (pathLink) return {...device, path: pathLink, stable: "by-path" as const};
        return device;
    });
}

/**
 * PulseAudio/PipeWire input sources (microphones), without monitor sources.
 */
export async function listAudioSources(): Promise<AudioSource[]> {
    try {
        const sources = JSON.parse(await run("pactl", ["--format=json", "list", "sources"]));
        return (Array.isArray(sources) ? sources : [])
            .filter((source: any) => !String(source?.name ?? "").endsWith(".monitor"))
            .map((source: any) => ({
                name: String(source.name),
                description: String(source.description || source.name),
            }));
    } catch {
        // pactl without JSON support
    }

    try {
        return (await run("pactl", ["list", "short", "sources"]))
            .split("\n")
            .map((line) => line.split("\t")[1])
            .filter((name) => name && !name.endsWith(".monitor"))
            .map((name) => ({name, description: name}));
    } catch {
        return [];
    }
}

/** UVC names are often "Model: Model"; keep one copy. */
function cleanName(name: string) {
    const [first, ...rest] = name.split(":").map((part) => part.trim());
    return rest.length === 1 && rest[0] === first ? first : name.trim();
}

/**
 * vendor:product:serial of the USB device behind a video node, "" without a
 * serial number (then by-id cannot tell identical cameras apart).
 */
function usbIdentity(videoBase: string) {
    // video4linux/videoN/device is the USB interface; its parent the device.
    try {
        const usbDevice = path.dirname(fs.realpathSync(`${videoBase}/device`));
        const serial = readSysfs(`${usbDevice}/serial`);
        if (!serial) return "";
        return `${readSysfs(`${usbDevice}/idVendor`)}:${readSysfs(`${usbDevice}/idProduct`)}:${serial}`;
    } catch {
        return "";
    }
}

function canOpen(node: string) {
    try {
        fs.accessSync(node, fs.constants.R_OK | fs.constants.W_OK);
        return true;
    } catch {
        return false;
    }
}

/**
 * All Coral Edge TPUs. USB ids follow libedgetpu's numbering ("usb:N" in
 * bus/device order); only distinct ids matter, as all Corals are identical.
 */
function detectCorals(): CoralDevice[] {
    const corals: CoralDevice[] = [];

    const usb: Array<{bus: number; dev: number}> = [];
    try {
        for (const device of fs.readdirSync("/sys/bus/usb/devices")) {
            const base = `/sys/bus/usb/devices/${device}`;
            const id = `${readSysfs(`${base}/idVendor`)}:${readSysfs(`${base}/idProduct`)}`;
            // Coral USB before (Global Unichip) and after firmware load (Google).
            if (id === "1a6e:089a" || id === "18d1:9302") {
                usb.push({bus: Number(readSysfs(`${base}/busnum`)), dev: Number(readSysfs(`${base}/devnum`))});
            }
        }
    } catch {
        // no USB sysfs
    }
    usb.sort((a, b) => a.bus - b.bus || a.dev - b.dev);
    usb.forEach(({bus, dev}, index) => {
        const node = `/dev/bus/usb/${String(bus).padStart(3, "0")}/${String(dev).padStart(3, "0")}`;
        corals.push({id: `usb:${index}`, type: "usb", node, accessible: canOpen(node)});
    });

    try {
        for (const entry of fs.readdirSync("/dev").filter((name) => /^apex_\d+$/.test(name)).sort()) {
            corals.push({id: `pci:${entry.slice(5)}`, type: "pci", node: `/dev/${entry}`, accessible: canOpen(`/dev/${entry}`)});
        }
    } catch {
        // no /dev listing
    }

    return corals;
}

function detectGpuVendor(): GpuInfo["vendor"] {
    if (fs.existsSync("/proc/driver/nvidia/version")) return "nvidia";
    try {
        const drivers = fs.readdirSync("/sys/class/drm")
            .filter((entry) => entry.startsWith("renderD"))
            .map((entry) => {
                try {
                    return path.basename(fs.realpathSync(`/sys/class/drm/${entry}/device/driver`));
                } catch {
                    return "";
                }
            });
        if (drivers.includes("i915") || drivers.includes("xe")) return "intel";
        if (drivers.includes("amdgpu")) return "amd";
    } catch {
        // no DRM
    }
    return null;
}

/** blurRoot: install dir of the privacy blur (holds the gpu-runtime marker). */
export function detectAccelerators(blurRoot: string): WebcamAccelerators {
    let rockchipNpu: string | null = null;
    const compatible = readSysfs("/proc/device-tree/compatible").replace(/\0/g, " ");
    const platform = ["rk3588", "rk3576", "rk3568", "rk3566", "rk3562"]
        .find((name) => compatible.includes(`rockchip,${name}`));
    if (platform && (fs.existsSync("/dev/rknpu") || fs.existsSync("/sys/module/rknpu"))) {
        rockchipNpu = platform;
    }

    const gpuRuntime = readSysfs(path.join(blurRoot, "gpu-runtime"));

    return {
        corals: detectCorals(),
        gpu: {vendor: detectGpuVendor(), runtime: gpuRuntime || null},
        rockchip_npu: rockchipNpu,
    };
}

/**
 * Picks the input format for a size: MJPG (cheap USB bandwidth, decoded in
 * ffmpeg) is preferred over raw YUYV.
 */
export function pickInputFormat(device: WebcamDevice | undefined, size: string) {
    if (!device || device.formats.length === 0) return null;

    for (const fourcc of ["MJPG", "YUYV"]) {
        const format = device.formats.find((entry) => entry.fourcc === fourcc);
        if (format && size in format.sizes) {
            return {fourcc, fps: format.sizes[size]};
        }
    }

    return null;
}
