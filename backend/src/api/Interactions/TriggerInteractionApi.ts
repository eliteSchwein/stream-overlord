import BaseApi from "../../abstracts/BaseApi";
import {getAssetConfig} from "../../helper/AssetHelper";
import {addAlert} from "../../helper/AlertHelper";
import {enqueueInteraction} from "../../helper/InteractionHelper";
import {isMacroPresent, triggerMacro} from "../../helper/MacroHelper";

export default class TriggerInteractionApi extends BaseApi {
    restEndpoint = "interaction";
    restPost = true;
    websocketMethod = "trigger_interaction";

    async handle(data: any): Promise<any> {
        const macro = String(data?.macro ?? "").trim();
        const assetName = String(data?.asset ?? "").trim();

        if (!macro && !assetName) return {error: "missing macro or asset"};
        if (macro && !isMacroPresent(macro)) return {error: "macro not found"};

        const asset = assetName ? getAssetConfig(assetName) : undefined;
        if (assetName && !asset) return {error: "asset not found"};

        const variables = data?.variables && typeof data.variables === "object" ? data.variables : {};
        const interaction = enqueueInteraction({
            name: String(data?.name ?? (macro && assetName
                ? `API: ${macro} + ${assetName}`
                : macro ? `API Macro: ${macro}` : `API Asset: ${assetName}`)),
            source: "api",
            estimatedDuration: asset && !macro ? Number(asset.duration ?? 15) || 0 : 0,
            execute: async current => {
                const runtimeVariables = {
                    ...variables,
                    eventUuid: current.uuid,
                    interactionUuid: current.uuid,
                };

                if (asset) {
                    addAlert({
                        ...asset,
                        asset: assetName,
                        variables: runtimeVariables,
                        interaction_uuid: current.uuid,
                        "event-uuid": current.uuid,
                    });
                }

                if (macro) await triggerMacro(macro, runtimeVariables);
            },
        });

        return {interaction};
    }
}
