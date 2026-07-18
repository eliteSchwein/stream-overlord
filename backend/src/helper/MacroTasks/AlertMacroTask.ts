import BaseMacroTask from "../../abstracts/BaseMacroTask";
import {v4 as uuidv4} from "uuid";
import {addAlert} from "../AlertHelper";
import {getAssetConfig, getWledConfigs, normalizeWledControls} from "../AssetHelper";
import {calculateTTSduration} from "../TTShelper";
import {logWarn} from "../LogHelper";
import {interpolateTemplate} from "../MacroHelper";

function interpolateObjectTemplate<T = any>(input: T, variables: any): T {
    if (input === undefined || input === null) {
        return input;
    }

    try {
        return JSON.parse(interpolateTemplate(JSON.stringify(input), variables));
    } catch (error) {
        logWarn(`failed to interpolate object template`);
        logWarn(JSON.stringify(error, Object.getOwnPropertyNames(error)));
        return input;
    }
}

function mergeWledDefaults(value: any) {
    const controls = normalizeWledControls(value);
    const configs = getWledConfigs();

    const result: Record<string, any> = {};

    for (const name in controls) {
        const baseConfig = configs[name] ?? {};
        result[name] = {
            ...baseConfig,
            ...controls[name],
        };
    }

    return result;
}

export default class AlertMacroTask extends BaseMacroTask {
    channel = "alert"

    async handle(method: string, data: any = {}, variables: any = {}) {
        const options = {
            ...data,
            eventUuid: data.eventUuid ?? variables.eventUuid,
        };

        const rawTheme = getAssetConfig(options.asset)

        if (!rawTheme) {
            logWarn(`no theme found for ${options.asset}`)
            return
        }

        if (!options.message) {
            logWarn(`no message provided`)
            return
        }

        const eventUuid = options.eventUuid ?? `macro_${uuidv4()}`

        const templateVariables = {
            ...variables,
            asset: options.asset,
            eventUuid,
        };

        const theme = interpolateObjectTemplate(rawTheme, templateVariables)

        let message = (options.message !== "" ? options.message : theme?.message) ?? "";

        if(options.speak) {
            message = theme?.message ?? ""
        }

        message = interpolateTemplate(String(message), templateVariables)

        const speakMessage = interpolateTemplate(String(options.message), templateVariables)

        const duration =
            options.speak === true
                ? calculateTTSduration(message)
                : theme.duration ?? 15

        addAlert({
            asset: options.asset,
            sound: theme.sound,
            duration,
            color: theme.color,
            icon: theme.icon,
            message,
            "event-uuid": eventUuid,
            speak: options.speak === true,
            speak_message: options.speak === true ? speakMessage : undefined,
            video: theme.video,
            wled: mergeWledDefaults(theme.wled),
            volume: theme.volume,
            image: theme.image,
            channel: theme.channel,
            start_macros: theme.start_macros ?? [],
            idle_macros: theme.idle_macros ?? [],
            end_macros: theme.end_macros ?? [],
            variables: templateVariables,
        });
    }
}
