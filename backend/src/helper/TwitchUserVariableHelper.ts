import {getExampleTwitchUserObject, getTwitchUserObject} from "./TwitchUserInfoHelper";
import {logWarn} from "./LogHelper";

/**
 * Global user objects for macro variables. The root name maps to the id fields
 * that identify that user in event/command/channel point payloads, in order.
 * E.g. a sub gift exposes the recipient as ${user} and the gifter as ${gifter};
 * a community gift only has a gifter, so ${user} falls back to it.
 */
const USER_ROOTS: Record<string, string[]> = {
    user: ["userId", "chatterId", "gifterId"],
    gifter: ["gifterId"],
};

type FoundUser = {
    id: string;
    prefix: string;
    scope: Record<string, any>;
};

function findUserId(variables: any, fields: string[]): FoundUser | undefined {
    const scopes = [variables, variables?.event, variables?.context]
        .filter(scope => scope && typeof scope === "object");

    for (const field of fields) {
        for (const scope of scopes) {
            const value = scope[field];

            if (value === undefined || value === null) continue;

            const id = String(value).trim();
            if (id) return {id, prefix: field.replace(/Id$/, ""), scope};
        }
    }

    return undefined;
}

function serializeSources(sources: any[]): string {
    try {
        return JSON.stringify(sources) ?? "";
    } catch {
        return "";
    }
}

function isReferenced(text: string, root: string) {
    return new RegExp(`\\$\\{\\s*${root}\\s*(?:[.}])`).test(text);
}

/**
 * Minimal object from the payload itself, used when the twitch lookup fails
 * (e.g. simulated events with made-up ids).
 */
function fallbackUser({id, prefix, scope}: FoundUser) {
    return {
        id,
        name: scope[`${prefix}Name`] ?? scope[`${prefix}Login`] ?? "",
        displayName: scope[`${prefix}DisplayName`] ?? scope[`${prefix}Name`] ?? "",
    };
}

/**
 * Adds ${user} / ${gifter} objects to the variables, but only when one of the
 * sources (macro tasks, asset config, ...) actually references them, so events
 * like chat messages do not cost twitch api calls for nothing.
 * Existing variables with the same name are never overwritten.
 */
export async function attachTwitchUserVariables(variables: any, sources: any[]) {
    if (!variables || typeof variables !== "object") return;

    const text = serializeSources(sources);
    if (!text.includes("${")) return;

    await Promise.all(Object.entries(USER_ROOTS).map(async ([root, fields]) => {
        if (variables[root] !== undefined) return;
        if (!isReferenced(text, root)) return;

        const found = findUserId(variables, fields);
        if (!found) return;

        let user: any = null;

        try {
            user = await getTwitchUserObject(found.id);
        } catch (error: any) {
            logWarn(`failed to load twitch user ${found.id} for \${${root}}: ${error?.message ?? error}`);
        }

        variables[root] = user ?? fallbackUser(found);
    }));
}

/**
 * Editor counterpart of attachTwitchUserVariables: adds example objects for
 * every user root the payload can provide.
 */
export function addExampleTwitchUserVariables(payload: Record<string, any>) {
    for (const [root, fields] of Object.entries(USER_ROOTS)) {
        if (payload[root] !== undefined) continue;

        const found = findUserId(payload, fields);
        if (!found) continue;

        payload[root] = getExampleTwitchUserObject({
            id: found.id,
            ...Object.fromEntries(
                Object.entries(fallbackUser(found)).filter(([, value]) => value),
            ),
        });
    }

    return payload;
}
