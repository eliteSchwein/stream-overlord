import {
    readSystemConfig,
    updateSystemConfig,
    type AssetTuneSettings,
    type GiveawaySettings,
    type CategoryLibrarySettings,
    type VirtualAudioCableSettings,
    type UiConfiguration,
} from "../../helper/ConfigHelper";
import BaseApi from "../../abstracts/BaseApi";

type SettingsSavePayload = {
    language?: string;
    touch_wallpaper?: string;
    asset_tune?: Partial<AssetTuneSettings>;
    giveaway?: Partial<GiveawaySettings>;
    category_library?: Partial<CategoryLibrarySettings>;
    virtual_audio_cables?: VirtualAudioCableSettings[];
    touch_dashboard?: UiConfiguration;
    local_admin_panel?: UiConfiguration;
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
            touch_dashboard: payload.touch_dashboard
                ? {...currentSettings.touch_dashboard, ...payload.touch_dashboard}
                : currentSettings.touch_dashboard,
            local_admin_panel: payload.local_admin_panel
                ? {...currentSettings.local_admin_panel, ...payload.local_admin_panel}
                : currentSettings.local_admin_panel,
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
