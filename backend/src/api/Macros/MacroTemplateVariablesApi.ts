import BaseApi from "../../abstracts/BaseApi";
import {getEditorTemplateVariables} from "../../helper/TemplateVariableEditorHelper";

export default class MacroTemplateVariablesApi extends BaseApi {
    restEndpoint = "macro/template_variables";
    restPost = true;
    websocketMethod = "macro_template_variables";

    async handle(data: any = {}): Promise<any> {
        try {
            return getEditorTemplateVariables(data);
        } catch (error: any) {
            return {error: error?.message ?? "failed to get template variables"};
        }
    }
}
