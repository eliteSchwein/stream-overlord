import BaseApi from "../../abstracts/BaseApi";
import {isMacroPresent, triggerMacro} from "../../helper/MacroHelper";
import {enqueueInteraction} from "../../helper/InteractionHelper";

export default class TriggerMacroApi extends BaseApi {
    restEndpoint = "macro";
    restPost = true;
    websocketMethod = "trigger_macro";

    async handle(data: any): Promise<any> {
        if (!data?.macro) return {error: "missing macro"};
        if (!isMacroPresent(data.macro)) return {error: "macro not found"};

        const interaction = enqueueInteraction({
            name: String(data.name ?? `Macro: ${data.macro}`),
            source: "api",
            execute: async current => {
                await triggerMacro(data.macro, {
                    ...(data.variables ?? {}),
                    eventUuid: current.uuid,
                    interactionUuid: current.uuid,
                });
            },
        });

        return {interaction};
    }
}
