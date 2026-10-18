import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";
import BaseApi from "../../abstracts/BaseApi";
import {
    editMacroFile,
    getMacroConfig,
    readMacroFile,
} from "../../helper/MacroHelper";

export default class MacroMetadataApi extends BaseApi {
    restEndpoint = "macro/metadata";
    restPost = true;
    websocketMethod = "macro_metadata";

    async handle(data: any): Promise<any> {
        try {
            const macro = String(
                data?.path
                ?? data?.file
                ?? data?.name
                ?? "",
            ).trim();

            if (!macro) {
                return {error: "macro path or name is required"};
            }

            const current = getMacroConfig(macro);
            if (!current) {
                return {error: "macro not found"};
            }

            const raw = await readMacroFile(macro);
            const extension = path.extname(raw.path).toLowerCase();
            let config: any;

            if (extension === ".json") {
                config = JSON.parse(raw.content);
            } else {
                config = yaml.load(raw.content) ?? {};
            }

            if (!config || typeof config !== "object" || Array.isArray(config)) {
                return {error: "invalid macro config"};
            }

            if (data?.description !== undefined) {
                config.description = String(data.description ?? "");
            }

            if (data?.hide_from_cloud !== undefined || data?.hideFromCloud !== undefined) {
                config.hide_from_cloud =
                    data?.hide_from_cloud === true
                    || data?.hideFromCloud === true;
                delete config.hideFromCloud;
            }

            const nextContent = extension === ".json"
                ? `${JSON.stringify(config, null, 2)}\n`
                : yaml.dump(config, {
                    noRefs: true,
                    lineWidth: -1,
                    sortKeys: false,
                });

            editMacroFile(raw.path, nextContent);

            const updated = getMacroConfig(config.name ?? macro);

            return {
                status: "okay",
                macro: updated,
            };
        } catch (error: any) {
            return {
                error: error?.message ?? "macro metadata update failed",
            };
        }
    }
}
