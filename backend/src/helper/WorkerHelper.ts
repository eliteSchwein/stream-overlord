import * as path from "node:path";
import {existsSync} from "node:fs";

// Worker entry points are bundled next to the main bundle (backend/dist/*.js).
export function resolveWorkerScript(fileName: string) {
    const candidates = [
        path.join(__dirname, fileName),
        path.resolve(process.cwd(), "backend/dist", fileName),
    ];

    return candidates.find(candidate => existsSync(candidate)) ?? candidates[0];
}
