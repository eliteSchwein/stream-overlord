import path from "path";
import {promises as fs} from "fs";
import {redis} from "../clients/redis/Redis";
import {logRegular, logSuccess, logWarn} from "./LogHelper";
import {getSystemConfigDirectory} from "./ConfigHelper";
import getWebsocketServer from "../App";

const STATIC_VARIABLES_FILE = "streambot-static-variables.json";
const REDIS_PREFIX = "variable_";
const memoryVariables: Record<string, any> = {};

function getStaticVariablesPath() {
    return path.join(getSystemConfigDirectory(), STATIC_VARIABLES_FILE);
}

function getRedisKey(key: string) {
    return `${REDIS_PREFIX}${key}`;
}

async function readStaticVariables(): Promise<Record<string, any>> {
    const file = getStaticVariablesPath();

    try {
        const content = await fs.readFile(file, "utf8");
        const parsed = JSON.parse(content);

        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            logWarn(`static variable file is invalid: ${file}`);
            return {};
        }

        return parsed;
    } catch (error: any) {
        if (error?.code === "ENOENT") return {};

        logWarn(`failed to read static variables: ${file}`);
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        return {};
    }
}

async function writeStaticVariables(variables: Record<string, any>) {
    const file = getStaticVariablesPath();

    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(variables, null, 2), "utf8");
}

function cloneVariables(variables: Record<string, any>) {
    return JSON.parse(JSON.stringify(variables));
}

function parseRedisValue(value: string | null | undefined) {
    if (value === undefined || value === null) return undefined;

    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

export async function initVariables() {
    const variables = await readStaticVariables();
    const keys = Object.keys(variables);

    Object.keys(memoryVariables).forEach((key) => delete memoryVariables[key]);
    Object.assign(memoryVariables, variables);

    logRegular(`load ${keys.length} static variables`);

    if (redis.isReady()) {
        for (const key of keys) {
            await redis.setVariable(getRedisKey(key), JSON.stringify(variables[key]));
        }
    }

    logSuccess(`loaded static variables`);
}

export function getCachedVariables() {
    return cloneVariables(memoryVariables);
}

export async function getVariables() {
    const keys = await listVariables();
    const variables: Record<string, any> = {};

    for (const key of keys) {
        variables[key] = await getVariable(key);
    }

    return variables;
}

export async function emitVariablesUpdate(client: WebSocket|undefined = undefined) {
    getWebsocketServer().send('notify_variables_update', await getVariables(), client);
}

export async function getVariable(key: string) {
    const value = await redis.getVariable(getRedisKey(key));

    if (value === undefined || value === null) {
        return memoryVariables[key];
    }

    const parsed = parseRedisValue(value);
    memoryVariables[key] = parsed;

    return parsed;
}

export async function setVariable(key: string, value: any, toFile: boolean = false) {
    if (value === undefined || value === null) {
        logWarn(`skip setting variable ${key}: value is ${value}`);
        return;
    }

    memoryVariables[key] = value;

    if (redis.isReady()) {
        await redis.setVariable(getRedisKey(key), JSON.stringify(value));
    }

    void emitVariablesUpdate();

    if (!toFile) return;

    const variables = await readStaticVariables();
    variables[key] = value;
    await writeStaticVariables(variables);
}

export async function deleteVariable(key: string, fromFile: boolean = false) {
    delete memoryVariables[key];

    if (redis.isReady()) {
        await redis.deleteVariable(getRedisKey(key));
    }

    if (!fromFile) return;

    const variables = await readStaticVariables();
    delete variables[key];
    await writeStaticVariables(variables);
}

export async function listVariables(): Promise<string[]> {
    const redisKeys = redis.isReady()
        ? await redis.keys(`${REDIS_PREFIX}*`)
        : [];

    const variableKeys = redisKeys.map((key: string) => key.substring(REDIS_PREFIX.length));

    return Array.from(new Set([
        ...Object.keys(memoryVariables),
        ...variableKeys,
    ]));
}
