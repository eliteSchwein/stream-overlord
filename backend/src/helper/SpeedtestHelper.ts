import {performance} from "node:perf_hooks";
import https from "node:https";
import getWebsocketServer from "../App";
import {logRegular, logWarn} from "./LogHelper";

const SPEEDTEST_BASE = "https://brrt.tludwig.dev";
const PING_SAMPLES = 5;
const DOWNLOAD_STREAMS = 6;
const DOWNLOAD_DURATION_MS = 12_000;
const UPLOAD_STREAMS = 6;
const UPLOAD_SIZE_BYTES = 20 * 1024 * 1024;
const UPLOAD_CHUNK_SIZE = 256 * 1024;
const NOTIFY_INTERVAL_MS = 150;

const downloadAgent = new https.Agent({
    keepAlive: true,
    maxSockets: DOWNLOAD_STREAMS,
    maxFreeSockets: DOWNLOAD_STREAMS,
});

export type SpeedtestStage =
    | "idle"
    | "ping"
    | "download"
    | "upload"
    | "finished"
    | "error";

export type SpeedtestState = {
    running: boolean;
    stage: SpeedtestStage;
    ping_ms: number | null;
    download_mbps: number | null;
    upload_mbps: number | null;
    error: string | null;
    started_at: string | null;
    finished_at: string | null;
};

let speedtestState: SpeedtestState = {
    running: false,
    stage: "idle",
    ping_ms: null,
    download_mbps: null,
    upload_mbps: null,
    error: null,
    started_at: null,
    finished_at: null,
};

let activeSpeedtest: Promise<void> | null = null;
let lastNotifyAt = 0;

function notifySpeedtestUpdate(force = false) {
    const now = performance.now();

    if (!force && now - lastNotifyAt < NOTIFY_INTERVAL_MS) {
        return;
    }

    lastNotifyAt = now;
    getWebsocketServer().send("notify_speedtest_update", getSpeedtestState());
}

function updateSpeedtestState(update: Partial<SpeedtestState>, forceNotify = true) {
    speedtestState = {
        ...speedtestState,
        ...update,
    };

    notifySpeedtestUpdate(forceNotify);
}

function buildSpeedtestUrl(path: string): string {
    const url = new URL(path, SPEEDTEST_BASE);
    url.searchParams.set("n", String(Math.random()));

    return url.toString();
}

async function fetchNoStore(path: string): Promise<Response> {
    return fetch(buildSpeedtestUrl(path), {
        method: "GET",
        cache: "no-store",
    });
}

function assertResponseOk(response: Response, message: string) {
    if (response.ok) return;

    throw new Error(`${message}: HTTP ${response.status}`);
}

function calculateMbps(bytes: number, start: number): number {
    const seconds = Math.max((performance.now() - start) / 1000, 0.001);

    return (bytes * 8) / seconds / 1_000_000;
}

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);

    return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

async function measurePing(): Promise<number> {
    const samples: number[] = [];

    for (let i = 0; i < PING_SAMPLES; i++) {
        const start = performance.now();

        const response = await fetchNoStore("/upload");
        assertResponseOk(response, "speedtest ping failed");

        await response.arrayBuffer();

        samples.push(performance.now() - start);

        updateSpeedtestState({
            ping_ms: median(samples),
        });
    }

    return median(samples);
}

async function downloadOnce(
    deadline: number,
    onBytes: (bytes: number) => void,
): Promise<void> {
    return await new Promise<void>((resolve, reject) => {
        const url = new URL("/downloading", SPEEDTEST_BASE);
        url.searchParams.set("n", String(Math.random()));

        const request = https.get(url, {
            agent: downloadAgent,
            family: 4,
            headers: {
                "cache-control": "no-cache",
            },
        }, response => {
            if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
                response.resume();
                reject(new Error(`speedtest download failed: HTTP ${response.statusCode ?? 0}`));
                return;
            }

            const stopAtDeadline = () => {
                if (performance.now() < deadline) return false;

                response.destroy();
                resolve();
                return true;
            };

            response.on("data", (chunk: Buffer) => {
                if (stopAtDeadline()) return;

                onBytes(chunk.length);
            });

            response.on("end", () => resolve());

            response.on("error", error => {
                // Destroying the response at the end of the test window is expected.
                if (performance.now() >= deadline) {
                    resolve();
                    return;
                }

                reject(error);
            });
        });

        request.on("error", error => {
            if (performance.now() >= deadline) {
                resolve();
                return;
            }

            reject(error);
        });

        if (performance.now() >= deadline) {
            request.destroy();
            resolve();
        }
    });
}

async function measureDownload(): Promise<number> {
    const start = performance.now();
    const deadline = start + DOWNLOAD_DURATION_MS;
    let receivedBytes = 0;

    const onBytes = (bytes: number) => {
        receivedBytes += bytes;

        speedtestState.download_mbps = calculateMbps(receivedBytes, start);
        notifySpeedtestUpdate();
    };

    const runWorker = async () => {
        while (performance.now() < deadline) {
            await downloadOnce(deadline, onBytes);
        }
    };

    await Promise.all(
        Array.from({length: DOWNLOAD_STREAMS}, () => runWorker())
    );

    const mbps = calculateMbps(receivedBytes, start);

    updateSpeedtestState({
        download_mbps: mbps,
    });

    return mbps;
}

async function measureUpload(): Promise<number> {
    const start = performance.now();
    let totalSentBytes = 0;

    const runStream = async () => {
        let sentBytes = 0;

        const body = new ReadableStream<Uint8Array>({
            pull(controller) {
                if (sentBytes >= UPLOAD_SIZE_BYTES) {
                    controller.close();
                    return;
                }

                const remaining = UPLOAD_SIZE_BYTES - sentBytes;
                const chunkSize = Math.min(UPLOAD_CHUNK_SIZE, remaining);

                controller.enqueue(new Uint8Array(chunkSize));

                sentBytes += chunkSize;
                totalSentBytes += chunkSize;

                speedtestState.upload_mbps = calculateMbps(totalSentBytes, start);
                notifySpeedtestUpdate();
            },
        });

        const response = await fetch(buildSpeedtestUrl("/upload"), {
            method: "POST",
            body,
            cache: "no-store",
            duplex: "half",
        } as RequestInit & {duplex: "half"});

        assertResponseOk(response, "speedtest upload failed");

        await response.arrayBuffer();
    };

    await Promise.all(
        Array.from({length: UPLOAD_STREAMS}, () => runStream())
    );

    const mbps = calculateMbps(totalSentBytes, start);

    updateSpeedtestState({
        upload_mbps: mbps,
    });

    return mbps;
}

async function executeSpeedtest() {
    const startedAt = new Date().toISOString();

    speedtestState = {
        running: true,
        stage: "ping",
        ping_ms: null,
        download_mbps: null,
        upload_mbps: null,
        error: null,
        started_at: startedAt,
        finished_at: null,
    };

    notifySpeedtestUpdate(true);

    try {
        logRegular("start speedtest");

        const ping = await measurePing();

        updateSpeedtestState({
            ping_ms: ping,
            stage: "download",
        });

        const download = await measureDownload();

        updateSpeedtestState({
            download_mbps: download,
            stage: "upload",
        });

        const upload = await measureUpload();

        updateSpeedtestState({
            running: false,
            stage: "finished",
            upload_mbps: upload,
            finished_at: new Date().toISOString(),
        });

        logRegular(
            `speedtest finished: ping=${ping.toFixed(0)}ms ` +
            `download=${download.toFixed(1)}Mbps upload=${upload.toFixed(1)}Mbps`
        );
    } catch (error: any) {
        const message = error?.message ?? String(error);

        logWarn(`speedtest failed: ${message}`);

        updateSpeedtestState({
            running: false,
            stage: "error",
            error: message,
            finished_at: new Date().toISOString(),
        });
    } finally {
        activeSpeedtest = null;
    }
}

export function getSpeedtestState(): SpeedtestState {
    return {
        ...speedtestState,
    };
}

export function isSpeedtestRunning(): boolean {
    return activeSpeedtest !== null || speedtestState.running;
}

export function startSpeedtest(): SpeedtestState {
    if (isSpeedtestRunning()) {
        return getSpeedtestState();
    }

    activeSpeedtest = executeSpeedtest();

    void activeSpeedtest.catch((error) => {
        logWarn(`unexpected speedtest failure: ${error?.message ?? String(error)}`);
        activeSpeedtest = null;
    });

    return getSpeedtestState();
}
