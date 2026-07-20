import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {logRegular, logWarn} from "../LogHelper";

export default class KeyboardMacroTask extends BaseMacroTask {
    channel = "keyboard";

    private normalizeKeys(value: unknown): string[] {
        if (Array.isArray(value)) {
            return value
                .flatMap((key) => this.normalizeKeys(key))
                .filter(Boolean);
        }

        if (value === null || value === undefined) {
            return [];
        }

        if (typeof value === "object") {
            const objectValue = value as Record<string, unknown>;

            // Support YAML objects produced by some editors, for example:
            // keys:
            //   ctrl: true
            //   a: true
            return Object.entries(objectValue)
                .filter(([, enabled]) => enabled !== false && enabled !== null && enabled !== undefined)
                .map(([key]) => key.trim())
                .filter(Boolean);
        }

        const rawValue = String(value).trim();

        if (!rawValue) {
            return [];
        }

        // Support a JSON-style array stored as a YAML string without requiring
        // the macro loader to parse it as JSON.
        if (rawValue.startsWith("[") && rawValue.endsWith("]")) {
            try {
                const parsed = JSON.parse(rawValue);

                if (Array.isArray(parsed)) {
                    return parsed
                        .map((key) => String(key).trim())
                        .filter(Boolean);
                }
            } catch {
                // Fall back to tolerant splitting below. This also accepts
                // imperfect values such as: [CTRL, SHIFT, A]
            }
        }

        return rawValue
            .replace(/^\[/, "")
            .replace(/\]$/, "")
            .split(/[,+\n]/)
            .map((key) => key.trim().replace(/^['"]|['"]$/g, ""))
            .filter(Boolean);
    }

    private normalizeDuration(value: unknown): number | undefined {
        if (value === null || value === undefined || value === "") {
            return undefined;
        }

        const duration = Number(value);

        if (!Number.isFinite(duration) || duration < 0) {
            return undefined;
        }

        return duration;
    }

    async handle(method: string, data: any = {}) {
        logRegular(`trigger keyboard: ${method}`);

        switch (method) {
            case "press": {
                const keys = this.normalizeKeys(data?.keys ?? data?.key);

                if (keys.length === 0) {
                    logWarn("keyboard press task has no valid keys");
                    return;
                }

                this.websocket.send("trigger_keyboard", {
                    name: String(data?.name ?? "macro"),
                    keys,
                    duration: this.normalizeDuration(data?.duration),
                });

                break;
            }

            default: {
                logWarn(`invalid keyboard method: ${method}`);
                break;
            }
        }
    }
}