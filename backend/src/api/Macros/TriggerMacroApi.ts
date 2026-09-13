import BaseApi from "../../abstracts/BaseApi";
import {isMacroPresent, triggerMacro} from "../../helper/MacroHelper";
import {randomUUID} from "crypto";

export default class TriggerMacroApi extends BaseApi {
    restEndpoint = "macro";
    restPost = true;
    websocketMethod = "trigger_macro";

    async handle(data: any): Promise<any> {
        if (!data?.macro) return {error: "missing macro"};
        if (!isMacroPresent(data.macro)) return {error: "macro not found"};

        const eventUuid = String(data?.eventUuid ?? data?.variables?.eventUuid ?? `api_macro_${randomUUID()}`);

        await triggerMacro(data.macro, {
            ...(data.variables ?? {}),
            eventUuid,
        });

        return {
            success: true,
            eventUuid,
            interaction: null,
        };
    }
}
