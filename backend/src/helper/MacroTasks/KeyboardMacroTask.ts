import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {logRegular, logWarn} from "../LogHelper";

export default class KeyboardMacroTask extends BaseMacroTask {
    channel = "keyboard";

    private static readonly DEFAULT_DURATION_MS = 100;
    private static readonly MIN_DURATION_MS = 10;

    private static readonly KEY_ALIASES: Record<string, string> = {
        ctrl: "ctrl_left",
        control: "ctrl_left",
        ctrlleft: "ctrl_left",
        leftctrl: "ctrl_left",
        ctrl_left: "ctrl_left",

        ctrlright: "ctrl_right",
        rightctrl: "ctrl_right",
        ctrl_right: "ctrl_right",

        alt: "alt_left",
        altleft: "alt_left",
        leftalt: "alt_left",
        alt_left: "alt_left",

        altright: "alt_right",
        rightalt: "alt_right",
        altgr: "alt_right",
        alt_right: "alt_right",

        escape: "esc",
        esc: "esc",
        tab: "tab",
        insert: "insert",
        ins: "insert",
        delete: "delete",
        del: "delete",
        home: "home",
        end: "end",
        backspace: "backspace",
        space: "space",
        spacebar: "space",
    };

    private normalizeKeys(value: unknown): string[] {
        const rawKeys = this.extractKeys(value);
        const normalized: string[] = [];

        for (const rawKey of rawKeys) {
            const key = this.normalizeKey(rawKey);

            if (!key) {
                logWarn(`unsupported keyboard key ignored: ${String(rawKey)}`);
                continue;
            }

            if (!normalized.includes(key)) {
                normalized.push(key);
            }
        }

        return normalized;
    }

    private extractKeys(value: unknown): unknown[] {
        if (Array.isArray(value)) {
            return value.flatMap((entry) => this.extractKeys(entry));
        }

        if (value === null || value === undefined) {
            return [];
        }

        if (typeof value === "object") {
            return Object.entries(value as Record<string, unknown>)
                .filter(([, enabled]) => Boolean(enabled))
                .map(([key]) => key);
        }

        const rawValue = String(value).trim();

        if (!rawValue) {
            return [];
        }

        if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
            try {
                const parsed = JSON.parse(rawValue);

                if (Array.isArray(parsed)) {
                    return parsed;
                }
            } catch {
                // Accept YAML-style inline arrays such as [ctrl_left, a].
            }
        }

        return rawValue
            .replace(/^\[/, "")
            .replace(/\]$/, "")
            .split(/[,+\n]/)
            .map((key) => key.trim().replace(/^['"]|['"]$/g, ""))
            .filter(Boolean);
    }

    private normalizeKey(value: unknown): string | undefined {
        const rawKey = String(value ?? "").trim();

        if (!rawKey) {
            return undefined;
        }

        if (rawKey.length === 1) {
            return rawKey.toLowerCase();
        }

        const lookupKey = rawKey
            .toLowerCase()
            .replace(/[\s-]+/g, "_");

        return KeyboardMacroTask.KEY_ALIASES[lookupKey]
            ?? KeyboardMacroTask.KEY_ALIASES[lookupKey.replace(/_/g, "")];
    }

    private normalizeDuration(value: unknown): number {
        if (value === null || value === undefined || value === "") {
            return KeyboardMacroTask.DEFAULT_DURATION_MS;
        }

        const duration = Number(value);

        if (!Number.isFinite(duration)) {
            return KeyboardMacroTask.DEFAULT_DURATION_MS;
        }

        return Math.max(
            KeyboardMacroTask.MIN_DURATION_MS,
            Math.round(duration),
        );
    }

    async handle(method: string, data: any = {}) {
        logRegular(`trigger keyboard: ${method}`);

        switch (method) {
            case "press": {
                const keys = this.normalizeKeys(data?.keys ?? data?.key);

                if (keys.length === 0) {
                    logWarn("keyboard press task has no keys supported by the connected firmware");
                    return;
                }

                const duration = this.normalizeDuration(data?.duration);

                this.websocket.send("trigger_keyboard", {
                    name: String(data?.name ?? "macro"),
                    keys,
                    duration,
                });

                break;
            }

            default:
                logWarn(`invalid keyboard method: ${method}`);
                break;
        }
    }
}
