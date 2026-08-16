import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {getOBSClient} from "../../App";
import {logRegular, logWarn} from "../LogHelper";
import {promises as fs} from "fs";
import os from "os";
import path from "path";
import {randomUUID} from "crypto";

function sleep(milliseconds: number) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function isPlainObject(value: any): value is Record<string, any> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeSettings(base: any, override: any): any {
    if (!isPlainObject(base) || !isPlainObject(override)) {
        return override;
    }

    const result: Record<string, any> = {...base};

    for (const [key, value] of Object.entries(override)) {
        result[key] = isPlainObject(value) && isPlainObject(result[key])
            ? mergeSettings(result[key], value)
            : value;
    }

    return result;
}

function interpolateSettings(start: any, end: any, progress: number): any {
    if (typeof start === 'number' && typeof end === 'number') {
        return start + ((end - start) * progress);
    }

    if (isPlainObject(start) || isPlainObject(end)) {
        const startObject = isPlainObject(start) ? start : {};
        const endObject = isPlainObject(end) ? end : {};
        const result: Record<string, any> = {};

        for (const key of new Set([...Object.keys(startObject), ...Object.keys(endObject)])) {
            if (!(key in endObject)) {
                result[key] = startObject[key];
                continue;
            }

            if (!(key in startObject)) {
                result[key] = endObject[key];
                continue;
            }

            result[key] = interpolateSettings(startObject[key], endObject[key], progress);
        }

        return result;
    }

    return progress >= 1 ? end : start;
}

export default class OBSMacroTask extends BaseMacroTask {
    channel = 'obs'

    async handle(method: string, data: any = {}, variables: any = {}) {
        const obsClient = getOBSClient();
        const connection = data.connection ?? data.obs ?? data.target ?? 'default';

        logRegular(`trigger obs (${connection}): ${method}`);

        const obsData = {...data};
        delete obsData.connection;
        delete obsData.obs;
        delete obsData.target;

        if (method === "reload_browser_sources") {
            await obsClient.reloadAllBrowserScenes(connection);
            return;
        }

        if (method === "transition_source_filter") {
            await this.transitionSourceFilter(obsClient, obsData, connection);
            return;
        }

        if (method === "GetSourceScreenshot") {
            await this.getSourceScreenshot(obsClient, obsData, connection, variables);
            return;
        }

        if (method === "get_output_screenshot") {
            await this.getOutputScreenshot(obsClient, obsData, connection, variables);
            return;
        }

        await obsClient.send(method, obsData, connection);
    }

    private sanitizeScreenshotData(data: any) {
        const result = {...data};
        delete result.resultVariable;

        for (const key of ['imageWidth', 'imageHeight', 'imageCompressionQuality']) {
            if (result[key] === null || result[key] === undefined || result[key] === '') {
                delete result[key];
            }
        }

        return result;
    }

    private async getSourceScreenshot(
        obsClient: any,
        data: any,
        connection: string,
        variables: any,
    ) {
        const sourceName = String(data.sourceName ?? '').trim();

        if (!sourceName) {
            logWarn('obs source screenshot requires sourceName');
            return;
        }

        await this.captureScreenshot(obsClient, data, connection, variables);
    }

    private async getOutputScreenshot(
        obsClient: any,
        data: any,
        connection: string,
        variables: any,
    ) {
        const websocket = obsClient.getOBSWebSocket(connection);

        if (!websocket) {
            logWarn(`obs ${connection} is currently not connected`);
            return;
        }

        logRegular(`obs (${connection}): resolving current program scene for output screenshot`);

        const currentProgramScene = await websocket.call('GetCurrentProgramScene');
        const sceneName = String(currentProgramScene?.currentProgramSceneName ?? '').trim();

        if (!sceneName) {
            logWarn(`obs ${connection} did not return a current program scene`);
            return;
        }

        await this.captureScreenshot(obsClient, {
            ...data,
            sourceName: sceneName,
        }, connection, variables);
    }

    private async captureScreenshot(
        obsClient: any,
        data: any,
        connection: string,
        variables: any,
    ) {
        const websocket = obsClient.getOBSWebSocket(connection);

        if (!websocket) {
            logWarn(`obs ${connection} is currently not connected`);
            return;
        }

        const resultVariable = String(data.resultVariable ?? 'screenshot').trim() || 'screenshot';
        const imageFormat = String(data.imageFormat ?? 'png').trim().toLowerCase() || 'png';
        const request = this.sanitizeScreenshotData({
            ...data,
            imageFormat,
        });

        const response = await websocket.call('GetSourceScreenshot', request);
        const imageData = String(response?.imageData ?? '');
        const match = imageData.match(/^data:image\/[^;]+;base64,(.+)$/s);

        if (!match) {
            logWarn(`obs ${connection} returned invalid screenshot image data`);
            return;
        }

        const extension = imageFormat === 'jpeg' ? 'jpg' : imageFormat;
        const filePath = path.join(
            os.tmpdir(),
            `streambot-obs-screenshot-${randomUUID()}.${extension}`,
        );

        await fs.writeFile(filePath, Buffer.from(match[1], 'base64'));
        variables[resultVariable] = filePath;

        logRegular(`obs screenshot saved to ${filePath} -> ${resultVariable}`);
    }

    private async transitionSourceFilter(obsClient: any, data: any, connection: string) {
        const sourceName = String(data.sourceName ?? '').trim();
        const filterName = String(data.filterName ?? '').trim();
        const durationSeconds = Math.max(0, Number(data.duration ?? 1));
        const configuredStart = isPlainObject(data.start) ? data.start : {};
        const configuredEnd = isPlainObject(data.end) ? data.end : {};

        if (!sourceName || !filterName) {
            logWarn('obs filter transition requires sourceName and filterName');
            return;
        }

        const websocket = obsClient.getOBSWebSocket(connection);

        if (!websocket) {
            logWarn(`obs ${connection} is currently not connected`);
            return;
        }

        const current = await websocket.call('GetSourceFilter', {
            sourceName,
            filterName,
        });

        const currentSettings = isPlainObject(current?.filterSettings) ? current.filterSettings : {};
        const startSettings = mergeSettings(currentSettings, configuredStart);
        const endSettings = mergeSettings(startSettings, configuredEnd);

        await websocket.call('SetSourceFilterEnabled', {
            sourceName,
            filterName,
            filterEnabled: true,
        });

        await websocket.call('SetSourceFilterSettings', {
            sourceName,
            filterName,
            filterSettings: startSettings,
            overlay: false,
        });

        if (durationSeconds <= 0) {
            await websocket.call('SetSourceFilterSettings', {
                sourceName,
                filterName,
                filterSettings: endSettings,
                overlay: false,
            });
            return;
        }

        const durationMilliseconds = durationSeconds * 1000;
        const frameDuration = 1000 / 60;
        const startedAt = Date.now();

        while (true) {
            const elapsed = Date.now() - startedAt;
            const progress = Math.min(1, elapsed / durationMilliseconds);

            await websocket.call('SetSourceFilterSettings', {
                sourceName,
                filterName,
                filterSettings: interpolateSettings(startSettings, endSettings, progress),
                overlay: false,
            });

            if (progress >= 1) break;

            await sleep(Math.min(frameDuration, Math.max(0, durationMilliseconds - elapsed)));
        }
    }
}
