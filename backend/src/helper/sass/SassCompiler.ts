import {Worker} from "node:worker_threads";
import {resolveWorkerScript} from "../WorkerHelper";
import {logWarn} from "../LogHelper";
import type {SassCompileRequest, SassCompileResponse} from "./SassWorker";

// The Sass compiler is large; keep the worker only while styles are compiling.
const IDLE_SHUTDOWN_MS = 60_000;

let worker: Worker | undefined;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let nextId = 1;
const pending = new Map<number, {resolve: (css: string) => void; reject: (error: Error) => void}>();

function rejectAll(error: Error) {
    for (const entry of pending.values()) {
        entry.reject(error);
    }
    pending.clear();
}

function scheduleIdleShutdown() {
    clearTimeout(idleTimer);
    if (pending.size > 0) return;

    idleTimer = setTimeout(() => {
        idleTimer = undefined;
        if (pending.size > 0 || !worker) return;

        const current = worker;
        worker = undefined;
        void current.terminate();
    }, IDLE_SHUTDOWN_MS);
    idleTimer.unref?.();
}

function getWorker() {
    if (worker) return worker;

    // The name becomes the OS thread name (visible in `top -H` / `ps -T`).
    const created = new Worker(resolveWorkerScript("sass-worker.js"), {name: "sass"});
    worker = created;

    created.on("message", (response: SassCompileResponse) => {
        const entry = pending.get(response.id);
        if (!entry) return;
        pending.delete(response.id);

        if (response.ok === true) {
            entry.resolve(response.css);
        } else {
            entry.reject(new Error((response as Extract<SassCompileResponse, {ok: false}>).message));
        }

        scheduleIdleShutdown();
    });

    created.on("error", error => {
        logWarn(`sass worker error: ${(error as any)?.message ?? error}`);
    });

    created.on("exit", code => {
        if (worker !== created) return;
        worker = undefined;
        rejectAll(new Error(`sass worker exited (code=${code})`));
    });

    return created;
}

/**
 * Compiles SCSS in the `sass` worker thread. Throws the Sass error message on
 * failure, like sass.compileString would.
 */
export function compileScssInWorker(content: string, url: string, loadPaths: string[]): Promise<string> {
    clearTimeout(idleTimer);
    const target = getWorker();
    const id = nextId++;

    return new Promise<string>((resolve, reject) => {
        pending.set(id, {resolve, reject});

        const request: SassCompileRequest = {id, content, url, loadPaths};
        target.postMessage(request);
    });
}
