import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {getYoloboxClient} from "../../App";
import {logRegular, logWarn} from "../LogHelper";
import fillTemplate from "../TemplateHelper";

export default class YoloboxMacroTask extends BaseMacroTask {
    channel = "yolobox";

    async handle(method: string, data: any = {}, variables: any = {}) {
        logRegular(`send yolobox command: ${method}`);

        const yoloboxClient = getYoloboxClient();
        const yoloboxData = yoloboxClient?.getData();

        if (!yoloboxClient || !yoloboxData) {
            logWarn("yolobox is currently not connected");
            return;
        }

        const templateData = {...data, variables};
        const text = (value: unknown) => fillTemplate(String(value ?? ""), templateData).trim();
        const number = (value: unknown, fallback?: number) => {
            const parsed = Number(fillTemplate(String(value ?? ""), templateData));
            return Number.isFinite(parsed) ? parsed : fallback;
        };
        const boolean = (value: unknown, fallback = false) => {
            if (typeof value === "boolean") return value;
            const parsed = text(value).toLowerCase();
            if (["true", "1", "yes", "on"].includes(parsed)) return true;
            if (["false", "0", "no", "off"].includes(parsed)) return false;
            return fallback;
        };

        const send = (orderID: string, commandData: Record<string, any>) => {
            yoloboxClient.sendCommand({orderID, data: commandData});
        };

        switch (method) {
            case "switch_video_source": {
                const id = text(data.id);
                if (!id) {
                    logWarn("yolobox switch_video_source requires an id");
                    return;
                }

                send("order_director_change", {
                    id,
                    isSelected: true,
                });
                return;
            }

            case "set_overlay": {
                const id = text(data.id);
                if (!id) {
                    logWarn("yolobox set_overlay requires an id");
                    return;
                }

                const isSelected = boolean(data.isSelected, true);
                const materialList = Array.isArray(yoloboxData.MaterialList)
                    ? yoloboxData.MaterialList
                    : [];

                if (id === "all") {
                    for (const material of materialList) {
                        if (material.isSelected === isSelected) continue;

                        send("order_material_change", {
                            id: material.id,
                            isSelected,
                        });
                    }
                    return;
                }

                const material = materialList.find((entry: any) => String(entry.id) === id);
                if (material?.isSelected === isSelected) return;

                send("order_material_change", {
                    id,
                    isSelected,
                });
                return;
            }

            case "set_audio_volume": {
                const id = text(data.id);
                if (!id) {
                    logWarn("yolobox set_audio_volume requires an id");
                    return;
                }

                const mixerList = Array.isArray(yoloboxData.MixerList)
                    ? yoloboxData.MixerList
                    : [];
                const current = mixerList.find((entry: any) => String(entry.id) === id);
                const volume = Math.max(0, Math.min(1, number(data.volume, current?.volume ?? 1) ?? 1));

                send("order_mixer_change", {
                    id,
                    isSelected: current?.isSelected ?? true,
                    volume,
                    AFV: current?.AFV ?? current?.afv ?? false,
                    delayTime: current?.delayTime ?? 0,
                });
                return;
            }

            case "set_audio_muted": {
                const id = text(data.id);
                if (!id) {
                    logWarn("yolobox set_audio_muted requires an id");
                    return;
                }

                const mixerList = Array.isArray(yoloboxData.MixerList)
                    ? yoloboxData.MixerList
                    : [];
                const current = mixerList.find((entry: any) => String(entry.id) === id);

                send("order_mixer_change", {
                    id,
                    isSelected: !boolean(data.muted, true),
                    volume: current?.volume ?? 1,
                    AFV: current?.AFV ?? current?.afv ?? false,
                    delayTime: current?.delayTime ?? 0,
                });
                return;
            }

            case "set_audio_delay": {
                const id = text(data.id);
                if (!id) {
                    logWarn("yolobox set_audio_delay requires an id");
                    return;
                }

                const mixerList = Array.isArray(yoloboxData.MixerList)
                    ? yoloboxData.MixerList
                    : [];
                const current = mixerList.find((entry: any) => String(entry.id) === id);
                const delayTime = Math.max(0, number(data.delayTime, current?.delayTime ?? 0) ?? 0);

                send("order_mixer_change", {
                    id,
                    isSelected: current?.isSelected ?? true,
                    volume: current?.volume ?? 1,
                    AFV: current?.AFV ?? current?.afv ?? false,
                    delayTime,
                });
                return;
            }

            case "set_audio_afv": {
                const id = text(data.id);
                if (!id) {
                    logWarn("yolobox set_audio_afv requires an id");
                    return;
                }

                const mixerList = Array.isArray(yoloboxData.MixerList)
                    ? yoloboxData.MixerList
                    : [];
                const current = mixerList.find((entry: any) => String(entry.id) === id);

                send("order_mixer_change", {
                    id,
                    isSelected: current?.isSelected ?? true,
                    volume: current?.volume ?? 1,
                    AFV: boolean(data.AFV),
                    delayTime: current?.delayTime ?? 0,
                });
                return;
            }

            // Compatibility with older combined audio macros.
            case "set_audio": {
                const id = text(data.id);
                if (!id) {
                    logWarn("yolobox set_audio requires an id");
                    return;
                }

                const mixerList = Array.isArray(yoloboxData.MixerList)
                    ? yoloboxData.MixerList
                    : [];
                const current = mixerList.find((entry: any) => String(entry.id) === id);

                send("order_mixer_change", {
                    id,
                    isSelected: boolean(data.isSelected, current?.isSelected ?? true),
                    volume: Math.max(0, Math.min(1, number(data.volume, current?.volume ?? 1) ?? 1)),
                    AFV: boolean(data.AFV, current?.AFV ?? current?.afv ?? false),
                    delayTime: Math.max(0, number(data.delayTime, current?.delayTime ?? 0) ?? 0),
                });
                return;
            }

            case "set_live_status": {
                const status = text(data.status);
                if (!["start", "stop"].includes(status)) {
                    logWarn("yolobox set_live_status requires status start or stop");
                    return;
                }

                send("order_live_status", {status});
                return;
            }

            // Keep raw frontend order methods compatible with existing macros.
            case "order_director_change":
            case "order_mixer_change":
            case "order_live_status":
                send(method, data);
                return;

            case "order_material_change": {
                const id = text(data.id);
                const isSelected = boolean(data.isSelected);
                const materialList = Array.isArray(yoloboxData.MaterialList)
                    ? yoloboxData.MaterialList
                    : [];

                if (id === "all") {
                    for (const material of materialList) {
                        if (material.isSelected === isSelected) continue;
                        send("order_material_change", {
                            id: material.id,
                            isSelected,
                        });
                    }
                    return;
                }

                const material = materialList.find((entry: any) => String(entry.id) === id);
                if (material?.isSelected === isSelected) return;

                send("order_material_change", {
                    ...data,
                    id,
                    isSelected,
                });
                return;
            }

            default:
                logWarn(`invalid yolobox method: ${method}`);
        }
    }
}
