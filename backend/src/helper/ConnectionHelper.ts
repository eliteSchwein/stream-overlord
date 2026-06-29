import {logWarn} from "./LogHelper";

export type ConnectionName = "twitch";
export type ConnectionState = "connected" | "connecting" | "disconnected" | "auth_required" | "error";

export interface ManagedConnection {
    name: ConnectionName;
    state: ConnectionState;
    enabled: boolean;
    connected: boolean;
    message?: string;
    updatedAt: number;
}

type ConnectionUpdateNotifier = (connections: Record<ConnectionName, ManagedConnection>) => void;

let notifier: ConnectionUpdateNotifier | undefined;

const connections: Record<ConnectionName, ManagedConnection> = {
    twitch: {
        name: "twitch",
        state: "disconnected",
        enabled: false,
        connected: false,
        updatedAt: Date.now()
    }
};

export function setConnectionUpdateNotifier(callback: ConnectionUpdateNotifier) {
    notifier = callback;
}

export function getManagedConnections() {
    return connections;
}

export function getManagedConnection(name: ConnectionName) {
    return connections[name];
}

export function setManagedConnection(
    name: ConnectionName,
    data: Partial<Omit<ManagedConnection, "name" | "updatedAt">>,
    notify = true
) {
    const current = connections[name];

    connections[name] = {
        ...current,
        ...data,
        name,
        connected: data.connected ?? data.state === "connected",
        updatedAt: Date.now()
    };

    if (!notify || !notifier) return connections[name];

    try {
        notifier(getManagedConnections());
    } catch (error) {
        logWarn("failed to notify connection update");
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }

    return connections[name];
}
