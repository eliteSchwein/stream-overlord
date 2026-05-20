import BaseApi from "../../abstracts/BaseApi";
import {updateSettings} from "../../helper/ConfigHelper";

export default class LanguageApi extends BaseApi {
    restEndpoint = "settings/language";
    websocketMethod = "settings_language";

    async handle(data: any): Promise<any> {
        const language = String(data?.language ?? "").trim().toLowerCase();

        if (!language) {
            return {
                success: false,
                error: "language is required"
            };
        }

        const settings = updateSettings({
            language
        });

        return {
            success: true,
            settings
        };
    }
}