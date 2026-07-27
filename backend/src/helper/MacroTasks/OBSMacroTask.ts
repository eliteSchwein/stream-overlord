import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {getOBSClient} from "../../App";
import {logRegular, logWarn} from "../LogHelper";

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

        await obsClient.send(method, obsData, connection);
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
