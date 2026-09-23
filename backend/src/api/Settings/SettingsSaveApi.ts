import {
    readSystemConfig,
    updateSystemConfig,
    type AssetTuneSettings,
    type GiveawaySettings,
    type CategoryLibrarySettings,
} from "../../helper/ConfigHelper";
import BaseApi from "../../abstracts/BaseApi";

type SettingsSavePayload = {
    language?: string;
    touch_wallpaper?: string;
    asset_tune?: Partial<AssetTuneSettings>;
    giveaway?: Partial<GiveawaySettings>;
    category_library?: Partial<CategoryLibrarySettings>;
};

export default class SettingsSaveApi extends BaseApi {
    restEndpoint = "settings/save";
    restPost = true;
    websocketMethod = "settings_save";

    async handle(data: SettingsSavePayload): Promise<any> {
        const currentSettings = readSystemConfig();
        const payload = data || {};

        const result = updateSystemConfig({
            ...payload,
            asset_tune: {
                ...currentSettings.asset_tune,
                ...(payload.asset_tune || {}),
            },
        });

        if (payload.category_library) {
            const {emitCategoryLibraryUpdate} = await import("../../helper/CategoryLibraryHelper");
            emitCategoryLibraryUpdate();
        }

        return result;
    }
}
