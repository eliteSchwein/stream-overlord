import * as fs from "node:fs";
import * as path from "node:path";
import {getSystemConfigDirectory} from "./ConfigHelper";
import getWebsocketServer from "../App";

const integrationsPath = path.join(getSystemConfigDirectory(), "integrations.json");

export type WledIntegration = {
    ip: string;
};

export type Integrations = {
    twitch?: any;
    wled?: Record<string, WledIntegration>;
};

export function readIntegrations(): Integrations {
    if (!fs.existsSync(integrationsPath)) return {};

    try {
        return JSON.parse(fs.readFileSync(integrationsPath, "utf8"));
    } catch {
        return {};
    }
}

export function writeIntegrations(data: Integrations) {
    fs.mkdirSync(path.dirname(integrationsPath), {recursive: true});
    fs.writeFileSync(integrationsPath, JSON.stringify(data, null, 4), "utf8");
}

export function getIntegrationsSafe(): Integrations {
    const integrations = readIntegrations();
    const {twitch: _twitch, ...safeIntegrations} = integrations;

    return safeIntegrations;
}

export function emitIntegrationsUpdate() {
    getWebsocketServer().send("notify_integrations_update", getIntegrationsSafe());
}

export function getWledIntegrations() {
    return readIntegrations().wled ?? {};
}

export function addWledIntegration(name: string, data: WledIntegration) {
    if (!name) throw new Error("name is required");
    if (!data.ip) throw new Error("url is required");

    const integrations = readIntegrations();

    integrations.wled ??= {};
    integrations.wled[name] = {
        ip: data.ip.replace(/\/+$/, "")
    };

    writeIntegrations(integrations);
    emitIntegrationsUpdate();
}

export function removeWledIntegration(name: string) {
    if (!name) throw new Error("name is required");

    const integrations = readIntegrations();

    if (integrations.wled) {
        delete integrations.wled[name];
    }

    writeIntegrations(integrations);
    emitIntegrationsUpdate();

    return integrations.wled ?? {};
}