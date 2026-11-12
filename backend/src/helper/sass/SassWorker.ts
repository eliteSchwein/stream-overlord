// Worker-thread entry point (bundled separately to dist/sass-worker.js).
//
// sass.compileString is synchronous and CPU heavy; running it here keeps the
// main event loop responsive while overlay styles compile.
//
// Must not import anything from the main application.

import {parentPort} from "node:worker_threads";
import * as sass from "sass";

export type SassCompileRequest = {
    id: number;
    content: string;
    url: string;
    loadPaths: string[];
};

export type SassCompileResponse =
    | {id: number; ok: true; css: string}
    | {id: number; ok: false; message: string};

if (!parentPort) {
    throw new Error("SassWorker must be started as a worker thread");
}

const port = parentPort;

port.on("message", (request: SassCompileRequest) => {
    let response: SassCompileResponse;

    try {
        const result = sass.compileString(request.content, {
            style: "expanded",
            url: new URL(request.url),
            loadPaths: request.loadPaths,
        });

        response = {id: request.id, ok: true, css: result.css};
    } catch (error) {
        response = {
            id: request.id,
            ok: false,
            message: error instanceof Error ? error.message : String(error),
        };
    }

    port.postMessage(response);
});
