import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {MIN_AUTO_MACRO_INTERVAL_MS, resetTemporaryAutoMacroInterval, setTemporaryAutoMacroInterval, toggleAutoMacro} from "../AutoMacroHelper";

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
                const intervalMs = data?.interval_ms !== undefined
                    ? Number(data.interval_ms)
                    : Number(data?.interval) * 1000;
                const durationMs = data?.duration_ms !== undefined
                    ? Number(data.duration_ms)
                    : data?.duration !== undefined
                        ? Number(data.duration) * 1000
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