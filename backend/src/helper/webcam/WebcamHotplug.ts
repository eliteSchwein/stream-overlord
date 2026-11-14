/**
 * Realtime hardware change events for the webcam integration:
 *  - udev (`udevadm monitor`): cameras (video4linux), USB devices such as a
 *    Coral Edge TPU, and sound cards
 *  - PulseAudio/PipeWire (`pactl subscribe`): microphones (sources) appearing
 *    or disappearing, e.g. a USB headset or a Bluetooth microphone
 * Without udevadm, /dev is watched for video nodes instead.
 */
import {ChildProcess, spawn} from "node:child_process";
import * as fs from "node:fs";
import {logNotice, logWarn} from "../LogHelper";

export type HardwareChange = "devices" | "audio";

const RESTART_DELAY_MS = 5_000;

export class HardwareMonitor {
    private udev: ChildProcess | null = null;
    private pactl: ChildProcess | null = null;
    private devWatcher: fs.FSWatcher | null = null;
    private timers = new Set<NodeJS.Timeout>();
    private stopped = false;

    constructor(private readonly onChange: (change: HardwareChange) => void) {}

    start() {
        this.stopped = false;
        this.startUdev();
        this.startPactl();
    }

    stop() {
        this.stopped = true;
        for (const timer of this.timers) clearTimeout(timer);
        this.timers.clear();
        this.udev?.kill();
        this.pactl?.kill();
        this.devWatcher?.close();
        this.udev = this.pactl = null;
        this.devWatcher = null;
    }

    private later(callback: () => void) {
        const timer = setTimeout(() => {
            this.timers.delete(timer);
            if (!this.stopped) callback();
        }, RESTART_DELAY_MS);
        this.timers.add(timer);
    }

    private readLines(child: ChildProcess, onLine: (line: string) => void) {
        let buffer = "";
        child.stdout?.on("data", (chunk: Buffer) => {
            buffer += chunk.toString("utf8");
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) onLine(line);
        });
    }

    private startUdev() {
        const child = spawn("udevadm", [
            "monitor", "--udev",
            "--subsystem-match=video4linux",
            "--subsystem-match=usb",
            "--subsystem-match=sound",
        ], {stdio: ["ignore", "pipe", "ignore"]});
        this.udev = child;

        // "UDEV  [1234.5678] add      /devices/.../video0 (video4linux)"
        this.readLines(child, (line) => {
            if (/^UDEV\s.*\s(add|remove|bind|unbind)\s/.test(line)) this.onChange("devices");
        });

        child.once("error", () => {
            if (this.udev !== child) return;
            this.udev = null;
            logNotice("udevadm not available, watching /dev for camera changes instead");
            this.startDevWatcher();
        });
        child.once("exit", () => {
            if (this.udev !== child || this.stopped) return;
            this.udev = null;
            this.later(() => this.startUdev());
        });
    }

    private startDevWatcher() {
        try {
            this.devWatcher = fs.watch("/dev", (_event, filename) => {
                if (filename && String(filename).startsWith("video")) this.onChange("devices");
            });
            this.devWatcher.on("error", (error) => {
                logWarn(`webcam device watcher stopped: ${error.message}`);
                this.devWatcher = null;
            });
        } catch (error: any) {
            logWarn(`webcam hotplug detection unavailable: ${error?.message ?? error}`);
        }
    }

    private startPactl() {
        const child = spawn("pactl", ["subscribe"], {stdio: ["ignore", "pipe", "ignore"]});
        this.pactl = child;

        // "Event 'new' on source #42"
        this.readLines(child, (line) => {
            if (/Event '(new|remove)' on source #/.test(line)) this.onChange("audio");
        });

        child.once("error", () => {
            if (this.pactl === child) this.pactl = null;
        });
        child.once("exit", () => {
            if (this.pactl !== child || this.stopped) return;
            this.pactl = null;
            // The sound server restarted or is not up yet.
            this.later(() => this.startPactl());
        });
    }
}
