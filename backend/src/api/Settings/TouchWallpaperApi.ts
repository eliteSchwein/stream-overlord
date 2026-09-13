import * as fs from "node:fs";
import * as path from "node:path";
import BaseApi from "../../abstracts/BaseApi";
import {imageRegex, videoRegex} from "../../helper/AssetHelper";
import {assetRoot, resolveAssetPath} from "../../helper/AssetManagementHelper";
import {setTouchWallpaper} from "../../helper/ConfigHelper";

export default class TouchWallpaperApi extends BaseApi {
    restEndpoint = "settings/touch_wallpaper";
    restPost = true;
    websocketMethod = "settings_touch_wallpaper";

    async handle(data: any): Promise<any> {
        const requestedPath = String(data?.path ?? data?.touch_wallpaper ?? "")
            .replace(/\\/g, "/")
            .replace(/^\/+/, "")
            .trim();

        if (!requestedPath) {
            const settings = setTouchWallpaper("");

            return {
                success: true,
                touch_wallpaper: "",
                settings,
            };
        }

        try {
            const resolved = resolveAssetPath(requestedPath);

            if (!fs.existsSync(resolved)) {
                return {success: false, error: "wallpaper asset not found"};
            }

            if (!fs.statSync(resolved).isFile()) {
                return {success: false, error: "wallpaper asset must be a file"};
            }

            if (!imageRegex.test(requestedPath) && !videoRegex.test(requestedPath)) {
                return {success: false, error: "wallpaper asset must be an image or video"};
            }

            const normalizedPath = path.relative(assetRoot, resolved).replace(/\\/g, "/");

            const settings = setTouchWallpaper(normalizedPath);

            return {
                success: true,
                touch_wallpaper: normalizedPath,
                settings,
            };
        } catch (error: any) {
            return {
                success: false,
                error: error?.message ?? "failed to set touch wallpaper",
            };
        }
    }
}
