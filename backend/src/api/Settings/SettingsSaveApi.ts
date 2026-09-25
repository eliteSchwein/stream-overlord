import {
    readSystemConfig,
    updateSystemConfig,
    type AssetTuneSettings,
    type GiveawaySettings,
    type CategoryLibrarySettings,
    type VirtualAudioCableSettings,
} from "../../helper/ConfigHelper";
import BaseApi from "../../abstracts/BaseApi";

type SettingsSavePayload = {
    language?: string;
    touch_wallpaper?: string;
    asset_tune?: Partial<AssetTuneSettings>;
    giveaway?: Partial<GiveawaySettings>;
    category_library?: Partial<CategoryLibrarySettings>;
    virtual_audio_cables?: VirtualAudioCableSettings[];
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

        if (payload.virtual_audio_cables) {
            const {syncVirtualAudioCableConfiguration} = await import("../../helper/VirtualAudioCableHelper");
            const {syncVirtualAudioCableRouting} = await import("../../helper/AudioHelper");

            await syncVirtualAudioCableConfiguration();
            await syncVirtualAudioCableRouting();
        }

        return result;
    }
}
