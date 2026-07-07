import {
    readSystemConfig,
    updateSystemConfig,
    type AssetTuneSettings,
} from "../../helper/ConfigHelper";
import BaseApi from "../../abstracts/BaseApi";

type SettingsSavePayload = {
    language?: string;
    asset_tune?: Partial<AssetTuneSettings>;
};

export default class SettingsSaveApi extends BaseApi {
    restEndpoint = "settings/save";
    restPost = true;
    websocketMethod = "settings_save";

    async handle(data: SettingsSavePayload): Promise<any> {
        const currentSettings = readSystemConfig();
        const payload = data || {};

        return updateSystemConfig({
            ...payload,
            asset_tune: {
                ...currentSettings.asset_tune,
                ...(payload.asset_tune || {}),
            },
        });
    }
}
