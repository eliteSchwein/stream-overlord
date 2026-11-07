import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {MIN_AUTO_MACRO_INTERVAL_MS, resetTemporaryAutoMacroInterval, setTemporaryAutoMacroInterval, toggleAutoMacro} from "../AutoMacroHelper";

function isSet(value: any) {
    return value !== undefined && value !== null && value !== "";
}

function toNumber(value: any) {
    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed === "" ? NaN : Number(trimmed);
    }
    return Number(value);
}

function unitFactor(unit: any, fallback: number) {
    switch (String(unit ?? "").trim().toLowerCase()) {
        case "ms":
        case "milliseconds":
            return 1;
        case "s":
        case "seconds":
            return 1000;
        case "min":
        case "minutes":
            return 60_000;
        case "h":
        case "hours":
            return 3_600_000;
        default:
            return fallback;
    }
}

export default class AutoMacroTask extends BaseMacroTask {
    getChannel(): string {
        return "auto_macro";
    }

    async run(channel: string, method: string, data: any = {}): Promise<any> {
        const name = data?.name ?? data?.autoMacro;

        switch (method) {
            case "enable":
            case "start":
                toggleAutoMacro(name, true);
                return true;

            case "disable":
            case "stop":
                toggleAutoMacro(name, false);
                return true;

            case "set_interval":
            case "temporary_interval": {
                // Values may come from template interpolation (e.g. "${effect_interval}000"),
                // so they can arrive as strings.
                const intervalMs = isSet(data?.interval_ms)
                    ? toNumber(data.interval_ms)
                    : toNumber(data?.interval) * unitFactor(data?.interval_unit, 1000);
                const durationMs = isSet(data?.duration_ms)
                    ? toNumber(data.duration_ms)
                    : isSet(data?.duration)
                        ? toNumber(data.duration) * unitFactor(data?.duration_unit, 1000)
                        : undefined;

                if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
                    throw new Error("auto_macro set_interval requires interval_ms or interval");
                }

                return setTemporaryAutoMacroInterval(
                    name,
                    Math.max(MIN_AUTO_MACRO_INTERVAL_MS, intervalMs),
                    durationMs,
                );
            }

            case "reset_interval":
            case "reset_temporary_interval":
                return resetTemporaryAutoMacroInterval(name);

            default:
                return false;
        }
    }
}